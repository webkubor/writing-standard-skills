#!/usr/bin/env node
/**
 * scripts/release-notes.mjs —— 开源发版说明生成器（GitHub / GitLab 通用）
 *
 * 职责：把一段提交历史变成**面向用户的中文发布说明**，并守住体裁边界。
 *
 * 为什么要有这个工具（2026-11-22）：
 *   release-please / GitLab Release 的自动正文是**提交清单**——中英混杂、
 *   同一个标题挂多个 SHA、连「test:」「release:」「chore:」这类过程性提交
 *   也混进「Bug Fixes」。读者是「要升级的陌生人」，看到这种清单无法判断
 *   自己该不该升级、变了什么、怎么装。工具把提交历史**翻译**成五段结构：
 *   新增特性 / 体验与性能优化 / 缺陷修复 / 破坏性变更与迁移 / 安装与升级。
 *
 * 平台无关：
 *   - 识别远端是 GitHub 还是 GitLab（git remote -v / glab / gh 的 remote host）；
 *   - GitHub 用 `gh release view` 取现有正文作对照，GitLab 用 `glab release view`；
 *   - 两边的命令、Release 页面结构、安装入口格式（npm / pypi / 手动安装）都不同，
 *     所以识别结果会决定安装段与链接格式。
 *
 * 零第三方依赖：只用 Node.js 内置模块 + git CLI（+ 可选 gh / glab）。
 *
 * 用法：
 *   node scripts/release-notes.mjs detect                     # 只识别平台与仓库
 *   node scripts/release-notes.mjs plan --from v1.2.0 --to v1.3.0
 *   node scripts/release-notes.mjs plan --from v1.2.0 --to v1.3.0 --json
 *   node scripts/release-notes.mjs plan --from v1.2.0 --to v1.3.0 --write CHANGELOG.md
 *   node scripts/release-notes.mjs plan --from v1.2.0 --to v1.3.0 --platform gitlab
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { argv, exit, stdout, stderr } from 'node:process';
import { fileURLToPath } from 'node:url';

// ── 平台识别 ────────────────────────────────────────────────────────────────

/** 从 git remote 猜平台。只认远端域名，不靠猜。 */
export function detectPlatform(remoteUrl) {
  const url = String(remoteUrl || '');
  if (/gitlab\./i.test(url) || /gitlab\.com/i.test(url)) return 'gitlab';
  if (/github\.com/i.test(url) || /github\./i.test(url)) return 'github';
  if (/bitbucket\./i.test(url)) return 'bitbucket';
  if (/gitee\.com/i.test(url)) return 'gitee';
  if (/codeberg\./i.test(url)) return 'codeberg';
  return 'unknown';
}

/** 从 remote url 取出 host 与 owner/repo。 */
export function parseRemote(remoteUrl) {
  const url = String(remoteUrl || '').trim();
  const m = url.match(/^(?:https?:\/\/|git@)([^/:]+)[/:](.+?)(?:\.git)?\/?$/);
  if (!m) return { host: null, namespace: null, name: null };
  const [, host, path] = m;
  const parts = path.split('/').filter(Boolean);
  return {
    host,
    namespace: parts.slice(0, -1).join('/') || null,
    name: parts[parts.length - 1] || null,
  };
}

/** 读当前仓库的 remote url。优先 origin。 */
export function readRemoteUrl(cwd = process.cwd()) {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  const all = spawnSync('git', ['remote', '-v'], { cwd, encoding: 'utf8' });
  const first = (all.stdout || '').split('\n').find((l) => l.includes('(fetch)'));
  if (!first) return null;
  const m = first.match(/\s(\S+)\s+\(fetch\)/);
  return m ? m[1] : null;
}

/** 识别结果汇总。 */
export function detect(cwd = process.cwd()) {
  const remoteUrl = readRemoteUrl(cwd);
  const { host, namespace, name } = parseRemote(remoteUrl);
  const platform = detectPlatform(remoteUrl);
  const pkg = readPackageJson(cwd);
  const releaseTool = detectReleaseTool(cwd);
  return {
    remoteUrl,
    platform,
    host,
    namespace,
    name,
    repo: namespace && name ? `${namespace}/${name}` : name,
    packageName: pkg?.name ?? null,
    version: pkg?.version ?? null,
    install: pkg ? detectInstall(pkg, platform) : null,
    releaseTool,
  };
}

/** 从 package.json 判断包管理器与安装入口。 */
export function readPackageJson(cwd) {
  const p = join(cwd, 'package.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function detectInstall(pkg, platform) {
  if (pkg?.name) return `npm install -g ${pkg.name}@latest`;
  if (platform === 'github') return 'git clone <repo> && cd <repo> && npm install && npm run build';
  return '见仓库 README 的安装说明';
}

/** 猜测项目用什么工具发版（决定版本号真源在哪）。 */
export function detectReleaseTool(cwd) {
  if (existsSync(join(cwd, 'release-please-config.json'))) return 'release-please';
  if (existsSync(join(cwd, '.gitlab-ci.yml')) && existsSync(join(cwd, '.release-please-manifest.json'))) return 'release-please';
  if (existsSync(join(cwd, 'pyproject.toml'))) return 'python';
  if (existsSync(join(cwd, 'Cargo.toml'))) return 'cargo';
  if (existsSync(join(cwd, 'go.mod'))) return 'go';
  if (existsSync(join(cwd, 'package.json'))) return 'npm';
  return 'unknown';
}

// ── 提交解析与分类 ───────────────────────────────────────────────────────────

/** 解析一条 Conventional Commit。 */
export function parseCommit(line) {
  // hash 至少 1 位十六进制：短 hash（git 的 --abbrev-commit 短形式）也要认
  const m = line.match(/^(?<hash>[0-9a-f]{1,40})\s+(?<rest>.*)$/);
  if (!m) return null;
  const { hash, rest } = m.groups;
  const c = rest.match(/^(?<type>[a-zA-Z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?:\s*(?<subject>.*)$/);
  if (!c) return { hash, type: 'other', scope: null, breaking: false, subject: rest.trim(), body: '' };
  const g = c.groups;
  return {
    hash,
    type: g.type.toLowerCase(),
    scope: g.scope || null,
    breaking: Boolean(g.breaking),
    subject: g.subject.trim(),
    body: rest.slice(c[0].length).trim(),
  };
}

/**
 * 提交类型 → 五段中的哪一段。
 *
 * 关键：**过程性提交不进发布说明**。test / ci / chore / build / docs / style / refactor
 * 本身不是用户能感知的变化；只有当它同时改动了用户可见行为（breaking、fix、feat）
 * 或需要特别提示（perf、revert）时才进正文。
 */
export function classify(commit) {
  const t = commit.type;
  if (commit.breaking) return 'breaking';
  if (t === 'feat' || t === 'feature') return 'feature';
  if (t === 'fix' || t === 'bugfix' || t === 'hotfix') return 'fix';
  if (t === 'perf') return 'perf';
  if (t === 'revert') return 'fix';
  if (t === 'security') return 'fix';
  // 过程性提交：默认不进正文
  return 'internal';
}

/**
 * 流程性 scope：这些 scope 下的提交即使类型是 feat/fix，也不进用户发布说明。
 *
 * 为什么需要：真实仓库里 `fix(release): restore 0.28.0 baseline`、
 * `feat(release): v0.28.0 — 15 套配色全量可选` 这类提交类型是 feat/fix，
 * 但内容是发版流程本身或 release-please 自动写的版本说明，
 * 放进用户正文会造成「同一个版本自己又发布了一次」的错觉。
 */
const PROCESS_SCOPES = new Set([
  'release', 'releases', 'release-please', 'chore', 'test', 'tests', 'spec',
  'ci', 'cd', 'build', 'deps', 'dependabot', 'lint', 'format', 'docs', 'doc',
  'version', 'publish', 'npm', 'workflow', 'actions', 'bot', 'typo',
]);

/** 是不是发版/测试/文档流程内部的提交。 */
export function isProcessCommit(commit) {
  const scope = (commit.scope || '').toLowerCase();
  if (scope && PROCESS_SCOPES.has(scope)) return true;
  // 无 scope 时看主题开头：release-please 写的版本说明提交
  const s = commit.subject.toLowerCase();
  if (/^(release|releases|chore\(release\)|prepare .*release|prepare v\d)/.test(s)) return true;
  if (/^v?\d+\.\d+\.\d+\s*[-—]/.test(s)) return true;   // 裸版本号标题 = 版本说明提交
  if (/^bump (version|changelog)|^release \d/.test(s)) return true;
  return false;
}

/** 是否值得出现在用户可见的发布说明里。 */
export function isUserVisible(commit) {
  if (isProcessCommit(commit)) return false;
  return classify(commit) !== 'internal';
}

/**
 * 提交类型是否暗示"用户能感知"。
 *
 * perf 特判：性能提交常常只动内部实现，用户未必感知；但 perf 若改了公开 API
 * 或默认行为，需要提示。脚本层面无法判断，交由 --include-internal 统一放开。
 */
export function readCommits(cwd, from, to) {
  const args = ['log', '--no-merges', '--pretty=format:%h%x1f%s%x1f%b%x1e'];
  if (from && from !== 'ALL') args.push(`${from}..${to || 'HEAD'}`);
  else if (to) args.push(to);
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    stderr.write(`读取提交历史失败：${(r.stderr || '').trim()}\n`);
    exit(2);
  }
  const out = [];
  for (const block of (r.stdout || '').split('\x1e')) {
    const rec = block.replace(/^\n+/, '');
    if (!rec.trim()) continue;
    const [hash, subject, body] = rec.split('\x1f');
    const c = parseCommit(`${hash} ${subject}`);
    if (!c) continue;
    c.body = (body || '').trim();
    out.push(c);
  }
  return out;
}

// ── 正文生成 ────────────────────────────────────────────────────────────────

/** 五段标题（中文，GitHub/GitLab 一致）。 */
export const SECTIONS = {
  feature: '### 新增特性',
  perf: '### 体验与性能优化',
  fix: '### 缺陷修复',
  breaking: '### 破坏性变更与迁移',
};

/**
 * 把一批提交整理成五段正文。
 *
 * 同一主题的多条提交会合并成一条（用 scope 或主题前缀归组），避免
 * 「同一个标题挂三个 SHA」这种读者看不懂的清单式正文。
 */
export function buildBody(commits, opts = {}) {
  const { installCmd = '', includeInternal = false } = opts;
  const buckets = { feature: [], perf: [], fix: [], breaking: [], internal: [] };
  const merged = new Map();

  for (const c of commits) {
    const kind = classify(c);
    // 流程性提交（发版/测试/文档）默认不进正文；--include-internal 才放出来
    if (isProcessCommit(c) && !includeInternal) continue;
    if (kind === 'internal' && !includeInternal) continue;
    // 归组键：scope 优先，其次主题首段（去掉变体后缀），否则按类型归一堆
    const key = c.scope ? `${kind}:${c.scope}` : `${kind}:${c.subject.split(/[:：]/)[0].trim()}`;
    if (!merged.has(key)) merged.set(key, { kind, subject: c.subject, hashes: [], scope: c.scope, subjects: [] });
    const g = merged.get(key);
    g.hashes.push(c.hash);
    // 同组多条提交要**全部保留标题** —— 只留最后一条会把前面几条真实修复吞掉
    if (!g.subjects.includes(c.subject)) g.subjects.push(c.subject);
    if (c.breaking && kind !== 'breaking') g.kind = 'breaking';
  }

  for (const g of merged.values()) buckets[g.kind].push(g);

  const lines = [];
  lines.push(`## [${opts.version}] - ${opts.date}`);
  lines.push('');
  lines.push(`> **一句话摘要**：${opts.summary || '（待补：用户升级后能感知的变化）'}`);
  lines.push('');

  for (const kind of ['feature', 'perf', 'fix']) {
    lines.push(SECTIONS[kind]);
    if (!buckets[kind].length) {
      lines.push('- 本版本无此类变化');
    } else {
      for (const g of buckets[kind]) {
        // 同组多条提交全部列出（scope 只在第一条出现，避免每行重复标注）
        const list = g.subjects && g.subjects.length ? g.subjects : [g.subject];
        list.forEach((s, i) => {
          const scope = i === 0 && g.scope ? `（${g.scope}）` : '';
          lines.push(`- ${s}${scope}`);
        });
      }
    }
    lines.push('');
  }

  lines.push(SECTIONS.breaking);
  if (!buckets.breaking.length) {
    lines.push('- 无破坏性变更（向后兼容）');
  } else {
    for (const g of buckets.breaking) {
      const list = g.subjects && g.subjects.length ? g.subjects : [g.subject];
      for (const s of list) lines.push(`- **${s}**`);
      lines.push(`  - Before → After：见对应提交 ${g.hashes.map((h) => `\`${h}\``).join(' ')}`);
      lines.push(`  - 受影响对象：${g.scope || '相关使用者'}`);
      lines.push(`  - 迁移动作：见提交说明`);
    }
  }
  lines.push('');

  // 内部变更：默认不出现在正文（读者不需要知道），--include-internal 时单列一段
  if (includeInternal && buckets.internal.length) {
    lines.push('### 内部变更（不面向用户）');
    for (const g of buckets.internal) lines.push(`- ${g.subject}`);
    lines.push('');
  }

  lines.push('### 安装与升级');
  lines.push('```text');
  lines.push(installCmd || '见仓库 README 的安装说明');
  lines.push('```');

  return lines.join('\n');
}

/** 标题格式：v<SemVer> — <一句话核心价值> */
export function buildTitle(version, summary) {
  return `v${version} — ${summary || '本版本更新'}`;
}

/**
 * 从提交里猜一句话摘要。
 *
 * 两个来源：
 *  1. release-please 写的版本说明提交（`feat(release): v0.28.0 — 15 套配色全量可选…`）
 *     —— 它是**人工写的一句话摘要**，质量最高，优先采用；
 *  2. 真正的 feat/fix 提交主题（跳过流程性提交）。
 */
export function guessSummary(commits) {
  // 来源 1：版本说明提交 —— 标题形如 "v0.28.0 — <摘要>"，取破折号后的部分
  for (const c of commits) {
    const m = c.subject.match(/^v?\d+\.\d+\.\d+(?:\.\d+)?\s*[—–\-:：]\s*(.+)$/);
    if (m && m[1].trim()) return m[1].trim();
  }
  // 来源 2：真实提交主题
  const usable = commits.filter((c) => !isProcessCommit(c));
  const feat = usable.find((c) => classify(c) === 'feature');
  const fix = usable.find((c) => classify(c) === 'fix');
  const pick = feat || fix;
  if (!pick) return '';
  return pick.subject.replace(/^(feat|fix|perf)(\([^)]*\))?!?:\s*/i, '').trim();
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argvIn) {
  const out = { _: [] };
  for (let i = 0; i < argvIn.length; i++) {
    const a = argvIn[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argvIn[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function usage() {
  stdout.write(`release-notes.mjs —— 开源发版说明生成器（GitHub / GitLab 通用）

  detect                                  识别平台、仓库、安装入口
  plan --from <tag> --to <ref>            生成五段结构发布说明
    --version <v>     版本号（默认读 package.json）
    --date <YYYY-MM-DD>
    --summary <一句话核心价值>
    --install <安装命令>
    --platform github|gitlab   手动指定（默认自动识别）
    --include-internal        连过程性提交也进正文（默认不进）
    --json                   输出 JSON
    --write <file>           追加写入文件（CHANGELOG.md）
`);
}

function main() {
  const args = parseArgs(argv.slice(2));
  const cmd = args._[0];

  if (!cmd || args.help) { usage(); exit(cmd ? 0 : 1); }

  const cwd = process.cwd();

  if (cmd === 'detect') {
    const info = detect(cwd);
    stdout.write(JSON.stringify(info, null, 2) + '\n');
    return;
  }

  if (cmd === 'plan') {
    const from = args.from && args.from !== 'ALL' ? args.from : null;
    const to = args.to || 'HEAD';
    const commits = readCommits(cwd, from, to);
    const det = detect(cwd);
    const platform = args.platform || det.platform;
    const pkg = readPackageJson(cwd);
    const version = args.version || (pkg?.version ?? '0.0.0');
    const date = args.date || new Date().toISOString().slice(0, 10);
    const summary = args.summary || guessSummary(commits);
    const installCmd = args.install || det.install || '';

    const body = buildBody(commits, { version, date, summary, installCmd, includeInternal: Boolean(args['include-internal']) });
    const title = buildTitle(version, summary);

    if (args.json) {
      stdout.write(JSON.stringify({
        platform, repo: det.repo, title, version, date, summary,
        install: installCmd, body,
        commits: commits.map((c) => ({ hash: c.hash, type: c.type, scope: c.scope, subject: c.subject, bucket: classify(c) })),
      }, null, 2) + '\n');
      return;
    }

    stdout.write(`# ${title}\n\n${body}\n`);
    if (args.write) {
      const f = resolve(cwd, args.write);
      const prev = existsSync(f) ? readFileSync(f, 'utf8') : '';
      writeFileSync(f, `${prev ? prev.replace(/\s*$/, '') + '\n\n' : ''}${body}\n`);
      stderr.write(`已写入 ${args.write}\n`);
    }
    return;
  }

  stderr.write(`未知命令：${cmd}\n\n`);
  usage();
  exit(1);
}

// 软链接场景下 process.argv[1] 是软链路径、import.meta.url 是真实路径，
// 直接比较会不相等 —— 脚本被链到 ~/.agents/skills/... 时就会静默不执行。
// 用 realpath 归一化后再比。
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    const invoked = realpathSync(process.argv[1]);
    const self = realpathSync(fileURLToPath(import.meta.url));
    return invoked === self;
  } catch {
    return import.meta.url === `file://${process.argv[1]}`;
  }
}
if (isMainModule()) main();
