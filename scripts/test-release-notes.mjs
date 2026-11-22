#!/usr/bin/env node
/**
 * scripts/test-release-notes.mjs —— release-notes.mjs 的自测
 *
 * 零第三方依赖、零网络。用临时 git 仓库做 fixture，跑真实 git 命令验证：
 *   1. 平台识别（GitHub / GitLab / 未知）
 *   2. Conventional Commit 解析
 *   3. 分类：过程性提交不进正文、breaking 进破坏性变更段
 *   4. 五段结构齐全、标题格式、摘要推断
 *   5. 真实仓库上 plan 跑通
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  detectPlatform, parseRemote, parseCommit, classify, isUserVisible, isProcessCommit,
  buildBody, buildTitle, guessSummary, detect, SECTIONS,
} from './release-notes.mjs';

let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) { pass++; stdout_ok(`✔ ${name}`); }
  else { fail++; failures.push(name); stdout_ok(`✖ ${name}${extra ? '  ' + extra : ''}`); }
}
function stdout_ok(s) { process.stdout.write(s + '\n'); }
function eq(name, actual, expected) {
  ok(name, Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected),
    `实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expected)}`);
}

// ── 1. 平台识别 ─────────────────────────────────────────────────────────────
eq('平台识别 GitHub', detectPlatform('git@github.com:webkubor/dsh-bloom-theme.git'), 'github');
eq('平台识别 GitHub https', detectPlatform('https://github.com/a/b.git'), 'github');
eq('平台识别自建 GitLab', detectPlatform('git@gitlab.ops.modelgo.com:modelgo/shared/modelgo-web.git'), 'gitlab');
eq('平台识别 gitlab.com', detectPlatform('https://gitlab.com/a/b.git'), 'gitlab');
eq('平台识别 Gitee', detectPlatform('https://gitee.com/a/b.git'), 'gitee');
eq('平台识别未知', detectPlatform('git@internal.host:a/b.git'), 'unknown');
eq('平台识别空', detectPlatform(''), 'unknown');

eq('remote 解析 ssh', parseRemote('git@github.com:webkubor/dsh-bloom-theme.git'),
  { host: 'github.com', namespace: 'webkubor', name: 'dsh-bloom-theme' });
eq('remote 解析 GitLab 多级 group', parseRemote('https://gitlab.ops.modelgo.com/modelgo/shared/web.git'),
  { host: 'gitlab.ops.modelgo.com', namespace: 'modelgo/shared', name: 'web' });

// ── 2. Conventional Commit 解析 ─────────────────────────────────────────────
const c1 = parseCommit('a1b2c3d feat(palette): 15 套配色全量可选');
eq('解析 type', c1.type, 'feat');
eq('解析 scope', c1.scope, 'palette');
eq('解析 subject', c1.subject, '15 套配色全量可选');
eq('解析 breaking 标记', parseCommit('abc1234 feat(api)!: 破坏性改动').breaking, true);
eq('解析无前缀提交', parseCommit('abc1234 随手改了下').type, 'other');
eq('解析 null', parseCommit('不是提交行'), null);

// ── 3. 分类 ─────────────────────────────────────────────────────────────────
eq('feat → feature', classify(parseCommit('a feat: x')), 'feature');
eq('fix → fix', classify(parseCommit('a fix: x')), 'fix');
eq('perf → perf', classify(parseCommit('a perf: x')), 'perf');
eq('breaking → breaking', classify(parseCommit('a feat!: x')), 'breaking');
eq('breaking 优先于 fix', classify(parseCommit('a fix!: x')), 'breaking');
eq('test → internal', classify(parseCommit('a test: x')), 'internal');
eq('chore → internal', classify(parseCommit('a chore: x')), 'internal');
eq('ci → internal', classify(parseCommit('a ci: x')), 'internal');
eq('docs → internal', classify(parseCommit('a docs: x')), 'internal');
eq('revert → fix', classify(parseCommit('a revert: x')), 'fix');
ok('过程性提交不可见', !isUserVisible(parseCommit('a chore: 内部整理')));
ok('feat 可见', isUserVisible(parseCommit('a feat: x')));

// 流程性 scope：类型是 feat/fix 也算过程性
ok('fix(release) 不可见', !isUserVisible(parseCommit('a fix(release): restore baseline')));
ok('feat(release) 不可见', !isUserVisible(parseCommit('a feat(release): v0.28.0 — 15 套配色')));
ok('fix(test) 不可见', !isUserVisible(parseCommit('a fix(test): slot 契约对齐')));
ok('feat(docs) 不可见', !isUserVisible(parseCommit('a feat(docs): 改文档')));
ok('裸版本号标题提交不可见', !isUserVisible(parseCommit('a chore: v0.29.0 — 新版说明')));
ok('release-please 版本说明提交不可见', !isUserVisible(parseCommit('a chore(release): prepare v0.29.0 release')));
ok('正常 fix 仍可见', isUserVisible(parseCommit('a fix(switcher): 菜单溢出')));
ok('正常 feat 仍可见', isUserVisible(parseCommit('a feat(starlight): 流星配置')));

// ── 4. 五段结构 ─────────────────────────────────────────────────────────────
const commits = [
  parseCommit('aaa1111 feat(palette): 15 套配色全量可选'),
  parseCommit('bbb2222 fix(menu): 菜单溢出视口 270px'),
  parseCommit('ccc3333 perf(render): 静置样式重算降到 0 次/秒'),
  parseCommit('ddd4444 chore: 内部整理'),
  parseCommit('eee5555 test: 加断言'),
  parseCommit('fff6666 feat(api)!: 移除旧配置项'),
  parseCommit('9998888 fix(release): restore unpublished baseline'),
  parseCommit('8887777 feat(release): v0.28.0 — 自动生成的版本说明标题'),
  parseCommit('7776666 fix(test): slot 契约对齐 v0.28.0'),
  parseCommit('6665555 chore: prepare v0.28.0 release media'),
];
const body = buildBody(commits, {
  version: '0.28.0', date: '2026-11-22',
  summary: '面板不再溢出', installCmd: 'npm install -g dsh-bloom-theme@latest',
});

ok('含新增特性段', body.includes(SECTIONS.feature));
ok('含体验与性能优化段', body.includes(SECTIONS.perf));
ok('含缺陷修复段', body.includes(SECTIONS.fix));
ok('含破坏性变更段', body.includes(SECTIONS.breaking));
ok('含安装与升级段', body.includes('### 安装与升级'));
ok('过程性提交不进正文', !body.includes('内部整理') && !body.includes('加断言'));
ok('fix(release) 不进正文', !body.includes('restore unpublished baseline'));
ok('feat(release) 版本说明提交不进正文', !body.includes('自动生成的版本说明标题'));
ok('fix(test) 不进正文', !body.includes('slot 契约对齐'));
ok('prepare release 不进正文', !body.includes('prepare v0.28.0 release media'));
ok('feat 进新增特性', body.includes('15 套配色全量可选'));
ok('fix 进缺陷修复', body.includes('菜单溢出视口'));
ok('perf 进性能段', body.includes('静置样式重算'));
ok('breaking 进破坏性变更段', body.includes('移除旧配置项'));
ok('有破坏性变更时不再写无破坏性变更', !body.includes('无破坏性变更'));
ok('breaking 段给 Before→After', body.includes('Before → After'));
ok('安装命令原样写入', body.includes('npm install -g dsh-bloom-theme@latest'));
ok('含版本与日期', body.includes('## [0.28.0] - 2026-11-22'));
ok('含一句话摘要', body.includes('> **一句话摘要**'));

// 无 breaking 时要显式说明
const body2 = buildBody([parseCommit('a feat: x')], { version: '1.0.0', date: '2026-01-01', summary: 's' });
ok('无 breaking 时显式声明无破坏性变更', body2.includes('无破坏性变更（向后兼容）'));
ok('空段落显式说明', body2.includes('- 本版本无此类变化'));

// include-internal 时过程性提交进正文
const body3 = buildBody(commits, { version: '1.0.0', date: '2026-01-01', summary: 's', includeInternal: true });
ok('include-internal 时过程性提交进正文', body3.includes('内部整理'));

// ── 5. 标题与摘要 ───────────────────────────────────────────────────────────
eq('标题格式', buildTitle('0.28.0', '面板不再溢出'), 'v0.28.0 — 面板不再溢出');
ok('标题不是裸版本号', !buildTitle('0.28.0', '').startsWith('release'));
eq('摘要优先用版本说明提交', guessSummary([
  parseCommit('aaa feat(release): v0.28.0 — 15 套配色全量可选、动效一键控制'),
  parseCommit('bbb fix(switcher): 菜单溢出'),
]), '15 套配色全量可选、动效一键控制');
eq('摘要无版本说明提交时取 feat', guessSummary([
  parseCommit('ccc feat(palette): 15 套配色全量可选'),
  parseCommit('bbb fix(switcher): 菜单溢出'),
]), '15 套配色全量可选');
eq('摘要无 feat 时取 fix', guessSummary([parseCommit('a fix(menu): 菜单修好了')]), '菜单修好了');

// 同组多条提交：标题要全部保留，不能被最后一条覆盖
const multi = buildBody([
  parseCommit('a1 fix(switcher): 菜单视口夹取'),
  parseCommit('a2 fix(switcher): 配色列表不再内层滚动'),
  parseCommit('a3 fix(switcher): 动效开关与下拉框对齐'),
], { version: '1.0.0', date: '2026-01-01', summary: 's' });
ok('同组多条标题全部保留',
  multi.includes('菜单视口夹取') && multi.includes('配色列表不再内层滚动') && multi.includes('动效开关与下拉框对齐'));
ok('同组 scope 只标一次', (multi.match(/（switcher）/g) || []).length === 1);

// ── 6. 真实 git 仓库 fixture ────────────────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'relnotes-'));
const repo = join(tmp, 'demo');
try {
  mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 't@t.io');
  git('config', 'user.name', 't');
  git('remote', 'add', 'origin', 'git@gitlab.ops.modelgo.com:modelgo/shared/demo.git');
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'demo-pkg', version: '1.4.0' }, null, 2));
  git('add', '.');
  git('commit', '-qm', 'chore: init');
  git('tag', 'v1.3.0');
  writeFileSync(join(repo, 'a.txt'), '1');
  git('add', '.');
  git('commit', '-qm', 'feat(api): 新增导出接口');
  writeFileSync(join(repo, 'b.txt'), '2');
  git('add', '.');
  git('commit', '-qm', 'fix(ui): 修复按钮错位');
  writeFileSync(join(repo, 'c.txt'), '3');
  git('add', '.');
  git('commit', '-qm', 'ci: 调整流水线');

  const det = detect(repo);
  eq('fixture 识别平台', det.platform, 'gitlab');
  eq('fixture 识别 host', det.host, 'gitlab.ops.modelgo.com');
  eq('fixture 识别 repo', det.repo, 'modelgo/shared/demo');
  eq('fixture 识别包名', det.packageName, 'demo-pkg');
  eq('fixture 识别版本', det.version, '1.4.0');
  ok('fixture 识别安装命令', det.install.includes('demo-pkg'));

  // plan 走真实 git log
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./release-notes.mjs', import.meta.url)),
    'plan', '--from', 'v1.3.0', '--to', 'HEAD', '--json'],
    { cwd: repo, encoding: 'utf8' });
  eq('plan 退出码 0', r.status, 0);
  const j = JSON.parse(r.stdout);
  eq('plan 平台', j.platform, 'gitlab');
  eq('plan 版本', j.version, '1.4.0');
  ok('plan 正文含新增', j.body.includes('新增导出接口'));
  ok('plan 正文含修复', j.body.includes('修复按钮错位'));
  ok('plan 正文排除 ci 提交', !j.body.includes('调整流水线'));
  eq('plan 标题格式', j.title.startsWith('v1.4.0 — '), true);
  ok('plan 提交清单标注 bucket', j.commits.find((c) => c.subject.includes('流水线')).bucket === 'internal');

// ── 7. 软链接调用（脚本被链到 ~/.agents/skills/... 时的静默不执行 bug）──
{
  const link = join(tmp, 'relnotes-link.mjs');
  const { symlinkSync } = await import('node:fs');
  const selfPath = fileURLToPath(new URL('./release-notes.mjs', import.meta.url));
  symlinkSync(selfPath, link);
  const r = spawnSync(process.execPath, [link, 'detect'], { cwd: repo, encoding: 'utf8' });
  ok('软链接调用有输出', r.stdout.trim().length > 0, `stdout=${JSON.stringify(r.stdout.slice(0, 80))}`);
  ok('软链接调用退出码 0', r.status === 0);
}

} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
process.stdout.write(`\n${pass} 通过 / ${fail} 失败\n`);
if (fail) { process.stdout.write(`失败项：${failures.join('、')}\n`); process.exit(1); }
