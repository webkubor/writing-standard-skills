#!/usr/bin/env node
// 版本自检：本地 skill 版本一致性 + 可选远端更新提示。
//   node scripts/check-version.mjs           只验本地
//   node scripts/check-version.mjs --remote  再查 GitHub 清单，落后就提示升级
// 远端不可达不算失败（fail-soft），但会明确说没验成。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const pkg = readJson('package.json');
const manifest = readJson('skills-manifest.json');
const versionRe = /^version:\s*["']?(\d+\.\d+\.\d+)["']?/m;

const parse = (v) => String(v).replace(/^v/, '').split('.').map(Number);
const newer = (a, b) => {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
};

let failed = 0;
const fail = (msg) => { console.error(`✗ ${msg}`); failed++; };
const ok = (msg) => console.log(`✓ ${msg}`);

// ① 仓版本与清单版本必须一致
if (pkg.version === manifest.version) ok(`仓版本与清单一致：v${pkg.version}`);
else fail(`仓版本 v${pkg.version} ≠ 清单版本 v${manifest.version}，改版本时两处都要改`);

// ② 每个 SKILL.md 必须有合法 version
const skillDirs = manifest.skills.slice().sort();
for (const name of skillDirs) {
  const path = join(root, 'skills', name, 'SKILL.md');
  if (!existsSync(path)) { fail(`清单里的 skill 没有 SKILL.md：${name}`); continue; }
  const m = readFileSync(path, 'utf8').match(versionRe);
  if (!m) fail(`${name} 的 SKILL.md 缺少 version`);
}
if (failed === 0) ok(`${skillDirs.length} 个 skill 都有版本`);

// ③ 清单与实际目录一致（多写/漏写都报）
const actual = (await import('node:fs')).readdirSync(join(root, 'skills'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, 'skills', d.name, 'SKILL.md')))
  .map((d) => d.name).sort();
const missing = actual.filter((s) => !skillDirs.includes(s));
const extra = skillDirs.filter((s) => !actual.includes(s));
if (missing.length || extra.length) {
  fail(`清单与目录漂移：目录有清单无 [${missing}]，清单有目录无 [${extra}]`);
} else ok('清单与 skill 目录一致');

// ④ 远端版本提示（可选）
if (process.argv.includes('--remote')) {
  const url = `https://raw.githubusercontent.com/webkubor/writing-standard-skills/${manifest.ref}/skills-manifest.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote = await res.json();
    if (newer(remote.version, manifest.version)) {
      console.log(`\n⚠️ 版本提示：本地 v${manifest.version}，远端 v${remote.version}。`);
      console.log('   升级：curl -fsSL https://raw.githubusercontent.com/webkubor/writing-standard-skills/main/install-remote.sh | bash');
    } else if (newer(manifest.version, remote.version)) {
      console.log(`○ 本地 v${manifest.version} 比远端 v${remote.version} 新（可能未推送）。`);
    } else {
      ok(`远端版本一致：v${manifest.version}`);
    }
  } catch (e) {
    console.log(`○ 远端版本未验成（${e.message}）；本地检查仍然有效。`);
  }
}

if (failed) {
  console.error(`\n版本自检失败：${failed} 项。`);
  process.exit(1);
}
console.log('\n版本自检通过。');
