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
import { readFileSync, writeFileSync, existsSync, realpathSync, readdirSync, statSync } from 'node:fs';
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
  const repo = namespace && name ? `${namespace}/${name}` : name;
  const url = cloneUrl(remoteUrl, host, namespace, name);
  return {
    remoteUrl,
    platform,
    host,
    namespace,
    name,
    repo,
    cloneUrl: url,
    packageName: pkg?.name ?? null,
    version: pkg?.version ?? null,
    install: pkg ? detectInstall(pkg, platform, url) : null,
    releaseTool,
  };
}

/** 从 package.json 判断包管理器与安装入口。 */
export function readPackageJson(cwd) {
  const p = join(cwd, 'package.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/**
 * 安装命令。platform 决定写法：
 *  - 有 npm 包名 → npm install -g <包名>@latest（任何平台都一样）
 *  - GitHub / GitLab 无包名 → clone + 构建，**必须填真实仓库地址**，
 *    不能留 `<repo>` 这种字面占位符 —— 读者复制执行必失败。
 */
export function detectInstall(pkg, platform, repoUrl) {
  if (pkg?.name) return `npm install -g ${pkg.name}@latest`;
  if (repoUrl) {
    const dir = String(repoUrl).replace(/\.git$/, '').split('/').pop() || 'repo';
    return `git clone ${repoUrl} && cd ${dir} && npm install && npm run build`;
  }
  if (platform === 'github' || platform === 'gitlab') return '见仓库 README 的安装说明';
  return '见仓库 README 的安装说明';
}

/** 由 remote 拼出可 clone 的 https 地址。 */
export function cloneUrl(remoteUrl, host, namespace, name) {
  if (remoteUrl && /^https?:\/\//.test(remoteUrl)) return remoteUrl.replace(/\.git$/, '');
  if (host && namespace && name) return `https://${host}/${namespace}/${name}`;
  return null;
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

/**
 * 解析一条 Conventional Commit。
 *
 * `breaking` 的判定有两个来源，缺一不可（Conventional Commits 规范里
 * `!` 与 `BREAKING CHANGE:` footer 等价，release-please 也认 footer）：
 *   1. subject 里的 `!`：`feat(api)!: …`
 *   2. body 里的 footer：`BREAKING CHANGE: …` 或 `BREAKING-CHANGE: …`
 * 只看 subject 会漏掉大量用 footer 声明破坏性的提交。
 */
export function parseCommit(line) {
  // hash 至少 1 位十六进制：短 hash（git 的 --abbrev-commit 短形式）也要认
  const m = line.match(/^(?<hash>[0-9a-f]{1,40})\s+(?<rest>.*)$/);
  if (!m) return null;
  const { hash, rest } = m.groups;
  const c = rest.match(/^(?<type>[a-zA-Z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?:\s*(?<subject>.*)$/);
  if (!c) return { hash, type: 'other', scope: null, breaking: false, subject: rest.trim(), rest: '' };
  const g = c.groups;
  const subject = g.subject.trim();
  // subject 之后的部分是提交正文（readCommits 会用 %b 再覆盖 body）
  const rest2 = rest.slice(c[0].length).trim();
  const breaking = Boolean(g.breaking) || hasBreakingFooter(subject + '\n' + rest2);
  return {
    hash,
    type: g.type.toLowerCase(),
    scope: g.scope || null,
    breaking,
    subject,
    rest: rest2,
    body: rest2,
  };
}

/** body 里是否有 BREAKING CHANGE footer（`BREAKING CHANGE:` / `BREAKING-CHANGE:`）。 */
export function hasBreakingFooter(text) {
  return /^BREAKING[ -]CHANGE\s*:/im.test(String(text || ''));
}

/**
 * 从 release 提交的 body 里取出人工写的版本说明条目。
 *
 * release-please 生成的 `feat(release): v0.28.0 — 一句话摘要` 提交，
 * **body 里常有完整的条目清单**（每条带 fixes #号），那是人工写的、
 * 本来就要给读者看的内容。整条丢掉会让「新增特性」段凭空变空，
 * 而这个版本最核心的那条价值恰好就在里面。
 *
 * 格式识别：body 的 bullet 行（`- ` / `* ` / `1. `）。
 *
 * ⚠️ 只对**版本说明提交**调用。别的提交（普通 fix/feat）的 body 里
 * 也可能有 bullet —— 那是给开发者看的实现说明，不是给读者的版本条目，
 * 混进来会污染正文。
 */
export function extractReleaseNotes(commit) {
  const body = String(commit.body || '');
  if (!body.trim()) return [];
  const items = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
    if (!m) continue;
    const text = m[1].trim();
    if (!text) continue;
    items.push(text);
  }
  return items;
}

/**
 * 这条提交是不是 release-please 写的**版本说明提交**。
 *
 * 判据（两条都命中才算）：
 *   1. subject 是「版本号 — 摘要」形态；
 *   2. scope 属于 release 相关，**或**压根没有 scope（release-please
 *      有时写成无 scope 的 `v0.28.0 — …`）。
 *
 * ⚠️ 不能只看 subject 的版本号形态：普通提交里出现
 * `fix(ui): v1.2.3 — 按钮错位` 这种写法很常见，它的 body 是给开发者的
 * 实现说明，混进「本版要点」就是正文污染。
 */
export function isVersionNoteCommit(commit) {
  const s = commit.subject.trim();
  const scope = (commit.scope || '').toLowerCase();
  const type = (commit.type || '').toLowerCase();
  const versionShape = /^v?\d+\.\d+\.\d+(\.\d+)?\s*[-—–:：]/.test(s);
  if (!versionShape) return false;
  // 有 scope：只有 release 相关 scope 才算
  if (scope) {
    return scope === 'release' || scope === 'releases' || scope === 'release-please';
  }
  // 无 scope：type 必须本身是 release 类。
  // ⚠️ `docs: v1.2.3 — …` / `chore: 1.0.1 — …` 这类**没有 scope**
  // （Conventional Commits 里 docs/chore 写在 type 位置），它们是普通提交，
  // body 是给开发者的实现说明 —— 不能当版本说明提交。
  return type === 'release' || type === 'releases' || type === 'release-please' || type === 'feat' || type === 'feature';
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
  // breaking 判定不能只依赖 commit.breaking 字段 ——
  // body 是后于 parse 填充的，字段可能还是 false。
  // 这里直接看 body 里有没有 BREAKING CHANGE footer，两条路都通。
  const breaking = commit.breaking || hasBreakingFooter(commit.body) || hasBreakingFooter(commit.rest);
  if (breaking) return 'breaking';
  if (t === 'feat' || t === 'feature') return 'feature';
  if (t === 'fix' || t === 'bugfix' || t === 'hotfix') return 'fix';
  if (t === 'perf') return 'perf';
  if (t === 'revert') return 'fix';
  if (t === 'security') return 'fix';
  // 过程性提交：默认不进正文
  return 'internal';
}

/**
 * 是不是发版/测试/文档流程内部的提交。
 *
 * 三条判据，缺一不可：
 *  1. scope 属于流程性词（release/test/ci/docs/…）—— 但 deps/build/version
 *     不在其中：依赖与运行时升级是**用户能感知**的（升级要求变了），
 *     整条排除会让正文凭空少一块，读者以为没变化。
 *  2. 标题是裸版本号形态（`v1.2.3 — …`，release-please 写的版本说明提交）。
 *  3. 标题以 `prepare … release` / `bump version` 开头。
 *
 * 注意**不能**用裸 `^release` 前缀砍：subject 里的 `feat:` 前缀已被剥掉，
 * `feat: release notes 面板上线` 的 subject 是「release notes 面板上线」，
 * 用 `^release` 会把这条普通特性误杀。
 */
const PROCESS_SCOPES = new Set([
  'release', 'releases', 'release-please', 'chore', 'test', 'tests', 'spec',
  'ci', 'cd', 'docs', 'doc', 'workflow', 'actions', 'bot', 'typo',
]);

export function isProcessCommit(commit) {
  const scope = (commit.scope || '').toLowerCase();
  if (scope && PROCESS_SCOPES.has(scope)) return true;
  const s = commit.subject.toLowerCase();
  // 裸版本号标题 = 版本说明提交
  if (/^v?\d+\.\d+\.\d+(\.\d+)?\s*[-—–:]/.test(s)) return true;
  if (/^bump (version|changelog)/.test(s)) return true;
  if (/^prepare .*release/.test(s)) return true;
  if (/^release\s+v?\d/.test(s)) return true;         // release v1.2.3
  if (/^release\s*[:：]/.test(s)) return true;          // release: xxx
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
    // git 的裸报错对使用者不友好：说清是哪个 ref 不存在、可用哪些 tag
    const err = (r.stderr || '').trim();
    const tags = spawnSync('git', ['tag', '--sort=-v:refname'], { cwd, encoding: 'utf8' });
    const available = (tags.stdout || '').trim().split('\n').filter(Boolean).slice(0, 10);
    stderr.write(`读取提交历史失败：${err}\n`);
    if (available.length) {
      stderr.write(`可用的版本 tag（最近 10 个）：${available.join(', ')}\n`);
      stderr.write(`确认 --from / --to 指向的 ref 存在后再跑一次。\n`);
    }
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
    // body 拿到真实正文后重算 breaking —— footer 里的 BREAKING CHANGE
    // 只有拿到真 body 才判得出来
    if (hasBreakingFooter(c.body)) c.breaking = true;
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
  const buckets = { feature: [], perf: [], fix: [], breaking: [], internal: [], release: [] };
  const merged = new Map();

  for (const c of commits) {
    const kind = classify(c);
    // 流程性提交（发版/测试/文档）默认不进正文
    if (isProcessCommit(c)) {
      // 但**版本说明提交**的 body 里有手工写的条目 —— 那是要给读者看的。
      // 只认版本说明提交：普通 fix/feat 的 body 里也有 bullet，
      // 那是给开发者看的实现说明，混进正文会污染内容。
      // --include-internal 时它进「内部变更」段，不重复出现在正文段里。
      const items = isVersionNoteCommit(c) ? extractReleaseNotes(c) : [];
      // 「本版要点」始终保留 —— 那是核心价值，
      // 即便 --include-internal 打开了也不该消失（它进「内部变更」段只是
      // 多列一条提交标题，正文要点不能跟着没）
      if (items.length) {
        buckets.release.push({ kind: 'release', subject: c.subject, hashes: [c.hash], scope: c.scope, subjects: [], items });
      }
      if (includeInternal) {
        const g = { kind: 'internal', subject: c.subject, hashes: [c.hash], scope: c.scope, subjects: [c.subject] };
        buckets.internal.push(g);
      }
      continue;
    }
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
  lines.push(`## [${normalizeVersion(opts.version)}] - ${opts.date}`);
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

  // release 版本说明提交里人工写的条目 —— 本版核心价值，最该给读者看
  if (buckets.release.length) {
    lines.push('');
    lines.push('### 本版要点');
    for (const g of buckets.release) {
      for (const it of g.items) lines.push(`- ${it}`);
    }
  }

  return lines.join('\n');
}

/**
 * 归一化版本号：剥掉前导 `v`、去空格。
 * 内部一律用裸版本号（0.28.0），显示时再补 `v`。
 */
export function normalizeVersion(v) {
  return String(v ?? '').trim().replace(/^v/i, '');
}

/**
 * 版本号真源，优先级：
 *   1. --version 显式指定
 *   2. --to 的 tag（`v0.28.0` → `0.28.0`）—— 这是**发布边界**，最权威
 *   3. package.json 的 version
 *
 * 只读 package.json 会出错：真实仓库 package.json 已 bump 到下一个版本，
 * 用它给上一区间生成说明会把 CHANGELOG 写错版本。
 */
export function resolveVersion({ version, to, pkg }) {
  if (version) return normalizeVersion(version);
  const fromTag = String(to || '').trim();
  if (/^v?\d+\.\d+\.\d+/.test(fromTag)) return normalizeVersion(fromTag.match(/^v?\d+\.\d+\.\d+(\.\d+)?/)[0]);
  if (pkg?.version) return normalizeVersion(pkg.version);
  return '0.0.0';
}

/** 标题格式：v<SemVer> — <一句话核心价值> */
export function buildTitle(version, summary) {
  return `v${normalizeVersion(version)} — ${summary || '本版本更新'}`;
}

/**
 * 从提交里猜一句话摘要。
 *
 * 两个来源：
 *  1. release-please 写的**版本说明提交**（`feat(release): v0.28.0 — 15 套配色全量可选…`）
 *     —— 它是**人工写的一句话摘要**，质量最高，优先采用；
 *  2. 真正的 feat/fix 提交主题（跳过流程性提交）。
 *
 * ⚠️ 摘要来源必须是版本说明提交。普通提交里出现版本号形态的标题很常见
 * （`fix(ui): v1.2.3 — 按钮错位`），拿它当摘要会把实现细节当核心价值。
 */
export function guessSummary(commits) {
  // 来源 1：版本说明提交 —— 标题形如 "v0.28.0 — <摘要>"，取破折号后的部分
  for (const c of commits) {
    if (!isVersionNoteCommit(c)) continue;
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

/**
 * 往 CHANGELOG.md 插入新版本小节。
 *
 * CHANGELOG 惯例是**新版本在最上面**。纯追加会把版本顺序弄反，
 * 读者看到的最新版本在最末尾。
 */
export function insertChangelog(prev, body) {
  const head = '# Changelog';
  if (!prev.trim()) return body + '\n';
  // 首个 `## [` 之前插入；没有版本小节就插在标题之后
  const m = prev.match(/^## \[/m);
  if (m) {
    const at = m.index;
    const before = prev.slice(0, at).replace(/\s*$/, '');
    const after = prev.slice(at).replace(/^\s+/, '');
    return `${before}\n\n${body}\n\n${after}\n`;
  }
  const lines = prev.split('\n');
  const titleIdx = lines.findIndex((l) => /^#\s/.test(l));
  const at = titleIdx >= 0 ? titleIdx + 1 : 0;
  const before = lines.slice(0, at).join('\n').replace(/\s*$/, '');
  const after = lines.slice(at).join('\n').replace(/^\s+/, '');
  return `${before}\n\n${body}\n\n${after}\n`;
}

// ── 发布媒体校验 ────────────────────────────────────────────────────────────

/**
 * 每版 GitHub / GitLab Release 正文公开时即须包含本版图片或可播放视频
 * （开源发布 SOP 的固定要求）。媒体缺失要在发版前就发现，
 * 不能等发布完再补 —— 那会产生「无图窗口」。
 *
 * 本命令只做**校验与提醒**：确认媒体文件真实存在、体积非零、
 * 并给出可粘贴的 Markdown 片段。不负责生成媒体。
 */
export function checkMedia(cwd, opts = {}) {
  const dirs = opts.dirs || ['assets/showcase', 'assets', 'docs/media', 'assets/releases'];
  const version = normalizeVersion(opts.version || '');
  const found = [];
  const missing = [];

  for (const d of dirs) {
    const full = join(cwd, d);
    if (!existsSync(full)) { missing.push(d); continue; }
    let entries = [];
    try {
      entries = readdirSync(full);
    } catch { continue; }
    for (const f of entries) {
      if (!/\.(png|jpe?g|gif|webp|mp4|webm|mov)$/i.test(f)) continue;
      const fullPath = join(full, f);
      let size = 0;
      try { size = statSync(fullPath).size; } catch {}
      if (!size) continue;
      const rel = `${d}/${f}`;
      // 「本版」判据必须**真的在路径里看到目标版本号** ——
      // 目录不存在时若回退成「全部都算本版」，一个根本不存在的版本
      // 也会被判为「有媒体」，媒体门禁就形同虚设了。
      const isCurrent = version ? mediaMatchesVersion(rel, version) : false;
      found.push({ path: rel, size, isCurrent });
    }
  }

  const images = found.filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f.path));
  const videos = found.filter((f) => /\.(mp4|webm|mov)$/i.test(f.path));
  const current = found.filter((f) => f.isCurrent);

  // 可粘贴片段**只给本版媒体** —— 非本版的留给人工挑选，不混进来
  const md = [];
  for (const v of videos.filter((f) => f.isCurrent)) md.push(`<video src="${v.path}" controls width="640"></video>`);
  for (const i of images.filter((f) => f.isCurrent)) md.push(`![${opts.alt || '版本预览'}](${i.path})`);

  return {
    version,
    ok: current.length > 0 && (images.length > 0 || videos.length > 0),
    counts: { total: found.length, images: images.length, videos: videos.length, current: current.length },
    media: found,
    markdown: md,
    historical: found.filter((f) => !f.isCurrent).map((f) => f.path),
    dirsMissing: missing,
  };
}

/**
 * 媒体路径是否属于指定版本。
 * 认 `v0.28.0` 与 `0.28.0` 两种写法（路径里通常带 v）。
 */
export function mediaMatchesVersion(relPath, version) {
  if (!version) return false;
  const v = normalizeVersion(version);
  const p = String(relPath);
  return p.includes(v) || p.includes(`v${v}`);
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
    --version <v>     版本号（默认取 --to 的 tag，其次 package.json）
    --date <YYYY-MM-DD>
    --summary <一句话核心价值>
    --install <安装命令>
    --platform github|gitlab   手动指定（默认自动识别）
    --include-internal        连过程性提交也进正文（默认不进）
    --json                   输出 JSON
    --write <file>           写入文件（新版本插到最上面）
  media --version <v>                   校验本版有无图片/视频，给可粘贴片段
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

  if (cmd === 'media') {
    const media = checkMedia(cwd, { version: args.version || '', alt: args.alt });
    if (args.json) {
      stdout.write(JSON.stringify(media, null, 2) + '\n');
    } else {
      stdout.write(`媒体检查（版本 ${media.version || '未指定'}）：\n`);
      stdout.write(`  图片 ${media.counts.images} 个 / 视频 ${media.counts.videos} 个 / 本版 ${media.counts.current} 个\n`);
      for (const m of media.media) stdout.write(`  - ${m.path}  ${(m.size / 1024).toFixed(0)} KB${m.isCurrent ? '' : '  (非本版)'}\n`);
      if (media.markdown.length) {
        stdout.write('\n可粘贴片段（仅本版媒体）：\n');
        for (const s of media.markdown) stdout.write(s + '\n');
      }
      if (media.historical.length) {
        stdout.write(`\n历史媒体（需人工挑选，未进片段）：${media.historical.join(', ')}\n`);
      }
      stdout.write(media.ok ? '\n✅ 有可用的本版媒体\n' : '\n❌ 未找到本版图片或视频 —— 发版前必须补上（Release 正文公开时即须含本版媒体）\n');
    }
    if (!media.ok) exit(1);
    return;
  }

  if (cmd === 'plan') {
    const from = args.from && args.from !== 'ALL' ? args.from : null;
    const to = args.to || 'HEAD';
    const commits = readCommits(cwd, from, to);
    const det = detect(cwd);
    const platform = args.platform || det.platform;
    const pkg = readPackageJson(cwd);
    const version = resolveVersion({ version: args.version, to, pkg });
    const date = args.date || new Date().toISOString().slice(0, 10);
    const summary = args.summary || guessSummary(commits);
    // --platform 覆盖要透传到安装命令，否则「识别结果决定安装段」是空话
    const installCmd = args.install || detectInstall(pkg, platform, det.cloneUrl) || det.install || '';

    const body = buildBody(commits, { version, date, summary, installCmd, includeInternal: Boolean(args['include-internal']) });
    const title = buildTitle(version, summary);

    if (args.json) {
      stdout.write(JSON.stringify({
        platform, repo: det.repo, title, version, date, summary,
        install: installCmd, body,
        commits: commits.map((c) => ({
          hash: c.hash, type: c.type, scope: c.scope, subject: c.subject,
          // bucket 必须与正文同源：正文走 isUserVisible 过滤，
          // 这里若用 classify() 会给出与正文矛盾的结论（被排除的提交却标 feature）
          bucket: isUserVisible(c) ? classify(c) : 'internal',
          visible: isUserVisible(c),
        })),
      }, null, 2) + '\n');
      return;
    }

    stdout.write(`# ${title}\n\n${body}\n`);
    if (args.write) {
      const f = resolve(cwd, args.write);
      const prev = existsSync(f) ? readFileSync(f, 'utf8') : '';
      writeFileSync(f, insertChangelog(prev, body));
      stderr.write(`已写入 ${args.write}（新版本在顶部）\n`);
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
