#!/usr/bin/env node
// 校验各 Agent 常驻配置里的 wss-kernel 块与 identity/kernel.md 一致。
// 本地：缺文件算失败（提醒先跑 install.sh）；CI：缺文件跳过（没装过是正常状态）。
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const BEGIN = '<!-- wss-kernel:begin -->';
const END = '<!-- wss-kernel:end -->';
const MAX_LINES = 60;

const kernelPath = join(root, 'identity/kernel.md');
if (!existsSync(kernelPath)) {
  console.error(`✗ 缺少内核真源 ${kernelPath}`);
  process.exit(1);
}
const source = readFileSync(kernelPath, 'utf8').trim();
const lineCount = source.split('\n').length;
if (lineCount > MAX_LINES) {
  console.error(`✗ 内核 ${lineCount} 行，超过 ${MAX_LINES} 行上限。常驻内容必须短，细则留在按需 skill。`);
  process.exit(1);
}
if (source.includes(BEGIN) || source.includes(END)) {
  console.error('✗ identity/kernel.md 不应自带标记，标记由 install.sh 包裹。');
  process.exit(1);
}

// --ci：只校验真源（CI runner 上没有各 Agent 的常驻配置）。
// 本地不带参数：校验四端是否安装且与真源一致。
const sourceOnly = Boolean(process.env.CI) || process.argv.includes('--ci');
if (sourceOnly) {
  console.log(`✓ 内核真源 ${lineCount} 行，约束通过（CI 模式只验真源）。`);
  process.exit(0);
}

const targets = [
  ['Claude Code', join(homedir(), '.claude/CLAUDE.md')],
  ['Codex', join(homedir(), '.codex/AGENTS.md')],
  ['Hermes', join(homedir(), '.hermes/SOUL.md')],
  ['OpenCode', join(homedir(), '.config/opencode/AGENTS.md')],
];

let failed = 0;
for (const [label, path] of targets) {
  if (!existsSync(path)) {
    console.error(`✗ ${label}: 文件不存在 ${path}（先跑 ./install.sh）`);
    failed++;
    continue;
  }
  const text = readFileSync(path, 'utf8');
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END, start);
  if (start === -1 || end === -1 || end < start) {
    console.error(`✗ ${label}: 缺少内核标记块 ${path}`);
    failed++;
    continue;
  }
  const block = text.slice(start + BEGIN.length, end).trim();
  if (block === source) {
    console.log(`✓ ${label}: 内核一致`);
  } else {
    console.error(`✗ ${label}: 内核漂移 ${path}（重跑 ./install.sh）`);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed}/${targets.length} 个常驻配置内核不一致。`);
  process.exit(1);
}
console.log(`\n内核 ${lineCount} 行；全部常驻配置一致。`);
