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
  hasBreakingFooter, extractReleaseNotes, resolveVersion, normalizeVersion,
  insertChangelog, detectInstall, isVersionNoteCommit,
  mediaMatchesVersion, checkMedia,
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

// JSON bucket 与正文同源
{
  const j = JSON.parse(spawnSync(process.execPath, [fileURLToPath(new URL('./release-notes.mjs', import.meta.url)),
    'plan', '--from', 'v1.3.0', '--to', 'HEAD', '--json'], { cwd: repo, encoding: 'utf8' }).stdout);
  const ci = j.commits.find((c) => c.subject.includes('调整流水线'));
  ok('JSON 中流程性提交标 internal', ci && ci.bucket === 'internal');
  ok('JSON 中可见性字段与 bucket 一致', j.commits.every((c) => (c.bucket === 'internal') === (c.visible === false)));
}

// 不存在的 tag 要给出可读错误（而不是裸 git 报错）
{
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./release-notes.mjs', import.meta.url)),
    'plan', '--from', 'v9.9.9', '--to', 'HEAD', '--json'], { cwd: repo, encoding: 'utf8' });
  ok('不存在的 tag 退出码非 0', r.status !== 0);
  ok('错误信息提到 tag/ref', /v9\.9\.9|unknown revision|未知|不存在/.test((r.stderr || '') + (r.stdout || '')),
    `stderr=${(r.stderr || '').slice(0, 120)}`);
}

// ── 9. 复审第二轮回归（新增功能带出的缺陷）─────────────────────────────

// 重要 1：版本说明提交判据 —— scope 与版本形态必须同时命中
{
  // 有 scope 但不是 release 的版本形态提交 → 不是版本说明提交
  const scoped = parseCommit('a1 fix(ui): v1.2.3 — 按钮错位');
  ok('scope=ui 的版本形态提交不算版本说明提交', !isVersionNoteCommit(scoped));
  const bodyS = buildBody([scoped], { version: '1.0.0', date: '2026-01-01', summary: 's' });
  ok('scope=ui 的 body 不进本版要点', !bodyS.includes('### 本版要点'));

  const docScope = parseCommit('a2 docs: v1.2.3 — 更新文档');
  docScope.body = '- 文档改动明细';
  ok('scope=docs 的版本形态提交不算版本说明提交', !isVersionNoteCommit(docScope));

  const choreScope = parseCommit('a3 chore: 1.0.1 — 更新锁文件');
  choreScope.body = '- 依赖升级明细';
  ok('scope=chore 的版本形态提交不算版本说明提交', !isVersionNoteCommit(choreScope));

  // release scope + 版本形态 → 是版本说明提交
  const real = parseCommit('a4 feat(release): v1.2.3 — 15 套配色全量可选');
  ok('scope=release 的版本形态提交算版本说明提交', isVersionNoteCommit(real));

  // 无 scope + 版本形态：type 必须本身是 release/feat 类
  const noScopeFeat = parseCommit('a5 feat: v1.2.3 — 15 套配色全量可选');
  ok('无 scope 的 feat 版本形态提交算版本说明提交', isVersionNoteCommit(noScopeFeat));
  const noScopeOther = parseCommit('a6 v1.2.3 — 随手写的一条');
  ok('无 scope 且 type 非 release 类的不算版本说明提交', !isVersionNoteCommit(noScopeOther));
}

// 重要 1 附带：摘要不能取自普通提交的版本形态标题
{
  const normalFix = parseCommit('b1 fix(ui): v1.2.3 — 按钮错位');
  ok('摘要不取自 scope=ui 的版本形态提交',
    guessSummary([normalFix]) !== '按钮错位');
  const realNote = parseCommit('b2 feat(release): v1.2.3 — 真正的核心价值');
  eq('摘要取自版本说明提交', guessSummary([realNote]), '真正的核心价值');
}

// 重要 2：media 本版判定必须真的看到版本号
{
  eq('媒体路径含裸版本号', mediaMatchesVersion('assets/showcase/0.28.0.png', '0.28.0'), true);
  eq('媒体路径含 v 前缀版本号', mediaMatchesVersion('assets/showcase/v0.28.0.png', 'v0.28.0'), true);
  eq('媒体路径不含版本号 → 非本版', mediaMatchesVersion('docs/media/old.png', '9.9.9'), false);
  eq('空版本号不匹配', mediaMatchesVersion('assets/x.png', ''), false);
}

// 重要 2：media 片段只含本版媒体
{
  const medDir = join(tmp, 'media-repo');
  mkdirSync(medDir);
  const mg = (...args) => execFileSync('git', args, { cwd: medDir, encoding: 'utf8' });
  mg('init', '-q');
  mg('config', 'user.email', 't@t.io');
  mg('config', 'user.name', 't');
  mg('remote', 'add', 'origin', 'git@github.com:a/media2.git');
  writeFileSync(join(medDir, 'package.json'), JSON.stringify({ name: 'media2', version: '1.0.0' }));
  mkdirSync(join(medDir, 'docs', 'media'), { recursive: true });
  writeFileSync(join(medDir, 'docs', 'media', 'old-screenshot.png'), Buffer.alloc(3000, 1));
  writeFileSync(join(medDir, 'docs', 'media', 'v2.0.0-shot.png'), Buffer.alloc(3000, 2));
  execFileSync('git', ['add', '.'], { cwd: medDir });
  mg('commit', '-qm', 'chore: init');

  const m2 = checkMedia(medDir, { version: '9.9.9' });
  ok('不存在的版本判为无本版媒体', m2.ok === false);
  eq('不存在的版本本版计数为 0', m2.counts.current, 0);
  ok('片段不含非本版媒体', !m2.markdown.some((s) => s.includes('old-screenshot')));
  ok('历史媒体单独列出', m2.historical.some((p) => p.includes('old-screenshot')));

  const m3 = checkMedia(medDir, { version: '2.0.0' });
  ok('存在的版本判为有本版媒体', m3.ok === true);
  ok('片段只含本版媒体', m3.markdown.length === 1 && m3.markdown[0].includes('v2.0.0-shot'));
}

// 次要 3：--include-internal 时「本版要点」仍保留
{
  const rc = parseCommit('c1 feat(release): v0.2.0 — 新版上线');
  rc.body = '- 核心价值条目';
  const bodyI = buildBody([rc], { version: '0.2.0', date: '2026-01-01', summary: 's', includeInternal: true });
  ok('include-internal 时本版要点保留', bodyI.includes('### 本版要点') && bodyI.includes('核心价值条目'));
  ok('include-internal 时有内部变更段', bodyI.includes('### 内部变更（不面向用户）'));
}

} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ── 8. 验收回归断言（独立验收指出的缺陷）───────────────────────────────

// 阻断 1：BREAKING CHANGE footer 必须被识别
const footerCommit = parseCommit('a1b2c3d feat(api): 改写导出接口');
footerCommit.body = 'BREAKING CHANGE: export() 改名为 exportAll()，请同步修改调用点。';
ok('BREAKING CHANGE footer 判为破坏性', hasBreakingFooter(footerCommit.body));
ok('BREAKING-CHANGE 连字符也识别', hasBreakingFooter('BREAKING-CHANGE: x'));
ok('普通 body 不误判', !hasBreakingFooter('Co-authored-by: someone'));
{
  const c = parseCommit('a1b2c3d feat(api): 改写导出接口');
  c.body = 'BREAKING CHANGE: 改名';
  eq('带 footer 的提交归入 breaking', classify(c), 'breaking');
  const bodyBc = buildBody([c], { version: '1.0.0', date: '2026-01-01', summary: 's' });
  ok('footer 破坏性进破坏性段', bodyBc.includes('改写导出接口') && !bodyBc.includes('无破坏性变更'));
}

// 阻断 2：^release 前缀不得误杀无 scope 的普通特性
ok('feat: release notes 不被误杀', isUserVisible(parseCommit('a feat: release notes 面板上线')));
ok('feat: 发布流程支持多渠道 不被误杀', isUserVisible(parseCommit('a feat: 发布流程支持多渠道')));
ok('feat(release): 仍被排除', !isUserVisible(parseCommit('a feat(release): v0.28.0 — 说明')));
ok('release v1.2.3 被排除', !isUserVisible(parseCommit('a chore: release v1.2.3')));
ok('release: xxx 被排除', !isUserVisible(parseCommit('a chore: release: xxx')));

// 阻断 3：deps/build 类不得整条排除（依赖升级是用户可感知的变化）
ok('feat(deps) 不被排除', isUserVisible(parseCommit('a feat(deps): 升级到 node 22')));
ok('feat(build) 不被排除', isUserVisible(parseCommit('a feat(build): 支持 node 22')));
{
  const bodyDeps = buildBody([parseCommit('a feat(deps): 升级到 node 22')], { version: '1.0.0', date: '2026-01-01', summary: 's' });
  ok('依赖升级进正文', bodyDeps.includes('升级到 node 22'));
}

// 重要 1：版本真源优先级 —— --to tag > package.json
eq('版本取 --to tag', resolveVersion({ to: 'v0.28.0', pkg: { version: '0.29.0' } }), '0.28.0');
eq('--version 优先于 --to', resolveVersion({ version: '1.2.3', to: 'v0.28.0', pkg: { version: '0.29.0' } }), '1.2.3');
eq('无 tag 时回落 package.json', resolveVersion({ to: 'HEAD', pkg: { version: '0.29.0' } }), '0.29.0');
eq('版本归一化剥 v', normalizeVersion('v1.2.3'), '1.2.3');
eq('标题不出现 vv', buildTitle('v0.28.0', 'x'), 'v0.28.0 — x');
{
  const bodyV = buildBody([], { version: 'v0.28.0', date: '2026-01-01', summary: 's' });
  ok('正文版本不带 v', bodyV.includes('## [0.28.0] -') && !bodyV.includes('[v0.28.0]'));
}

// 重要 3：CHANGELOG 插入到最前（倒序）
{
  const prev = '# Changelog\n\n## [1.0.0] - 2026-01-01\n\n- 旧版内容\n';
  const out = insertChangelog(prev, '## [1.2.0] - 2026-02-01\n\n- 新版内容');
  ok('新版本在旧版本之上', out.indexOf('## [1.2.0]') < out.indexOf('## [1.0.0]'));
  ok('旧内容保留', out.includes('旧版内容') && out.includes('新版内容'));
}

// 重要 5：安装命令不留字面占位符
ok('安装命令无 <repo> 占位符', !detectInstall(null, 'github', 'https://github.com/a/b').includes('<repo>'));
ok('安装命令含真实地址', detectInstall(null, 'github', 'https://github.com/a/b').includes('https://github.com/a/b'));
ok('有包名时用 npm', detectInstall({ name: 'pkg-x' }, 'gitlab', null).includes('npm install -g pkg-x@latest'));

// 新增能力：release 提交 body 的条目回填为「本版要点」
{
  const rc = parseCommit('a1 feat(release): v0.28.0 — 15 套配色全量可选');
  rc.body = '- 补齐 15 套莫兰迪配色进菜单，消除底部切字 (fixes #132)\n- 根治空闲样式重算 (fixes #130)';
  ok('版本说明提交识别', isVersionNoteCommit(rc));
  const items = extractReleaseNotes(rc);
  eq('release body 解析出条目数', items.length, 2);
  ok('条目内容正确', items[0].includes('15 套莫兰迪配色'));
  const bodyR = buildBody([rc], { version: '0.28.0', date: '2026-01-01', summary: 's' });
  ok('release 条目进本版要点段', bodyR.includes('### 本版要点') && bodyR.includes('消除底部切字'));
}

// 普通提交的 body bullet 不得混进「本版要点」
{
  const normal = parseCommit('a2 fix(css): 修复括号配对');
  normal.body = '- `} catch {` 的 catch 与闭合括号同行，必须逐字符定位\n- 往上找到的 try 可能早已闭合';
  ok('普通提交不算版本说明提交', !isVersionNoteCommit(normal));
  const bodyN = buildBody([normal], { version: '1.0.0', date: '2026-01-01', summary: 's' });
  ok('普通提交 body 不进本版要点', !bodyN.includes('### 本版要点'));
  ok('普通提交 body 不污染正文', !bodyN.includes('catch 与闭合括号同行'));
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
process.stdout.write(`\n${pass} 通过 / ${fail} 失败\n`);
if (fail) { process.stdout.write(`失败项：${failures.join('、')}\n`); process.exit(1); }
