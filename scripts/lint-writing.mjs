#!/usr/bin/env node
/**
 * scripts/lint-writing.mjs —— 表达规范与去 AI 味静态检查门禁
 *
 * 职责：对 Markdown 文档进行词法与句式级扫描，机械拦截假人 AI 味、
 * 机械排比、公关套话与空洞升华。
 *
 * 零第三方依赖：仅依赖 Node.js 内置模块。
 *
 * 用法：
 *   node scripts/lint-writing.mjs               # 默认扫描 skills/
 *   node scripts/lint-writing.mjs <file|dir>    # 扫描指定路径
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { exit, argv } from 'node:process';

// ── 规则库定义 ───────────────────────────────────────────────────────────────

const RULES = [
  {
    id: 'ai-cliche-transitions',
    category: '假人过渡词',
    desc: '论文腔与机械过渡词，真人交流极少使用',
    pattern: /(?:总的来说|值得一提的是|毋庸置疑|不可否认|显而易见的是|众所周知|综上所述|正如前文所述)/g,
    hint: '直接说结论，或换成口语转折词（“其实”、“说白了”、“最离谱的是”）',
  },
  {
    id: 'mechanical-parallelism',
    category: '机械排比',
    desc: '对称汇报八股腔，透着浓厚的翻译与假人感',
    pattern: /(?:不仅[\u4e00-\u9fa5]{1,20}更是|既是[\u4e00-\u9fa5]{1,20}也是|既能[\u4e00-\u9fa5]{1,20}又能|不仅能够[\u4e00-\u9fa5]{1,20}还能)/g,
    hint: '拆成两句口语短句，前后带明确因果或动作转折',
  },
  {
    id: 'empty-flourish',
    category: '假大空高中作文修辞',
    desc: '毫无信息量的抒情堆砌与陈词滥调',
    pattern: /(?:犹如一幅.*画卷|宛如晨曦|在这个快节奏的.*时代|历史的长河|时光荏苒|岁月如梭)/g,
    hint: '换成具体的时间、地点、环境或微观感官事实细节',
  },
  {
    id: 'pr-evasiveness',
    category: '公关推诿套话',
    desc: '事故通报与客诉中的空洞八股，极度激化矛盾',
    pattern: /(?:给您带来不便敬请谅解|深刻吸取教训|举一反三|深表歉意|不便之处敬请海涵)/g,
    hint: '删掉所有套话！直接陈述补偿方案与不可绕过的物理阻断机制',
  },
  {
    id: 'hollow-ending',
    category: '空洞正能量升华',
    desc: '结尾强行鸡汤升华，破坏客观事实的粗粝感',
    pattern: /(?:愿我们.*(?:岁月|光芒|前行)|砥砺前行|未来可期|让我们携手共创)/g,
    hint: '说到客观事实或留一个具体互动问题就停，绝不强行升华',
  },
];

// ── 单文件扫描 ───────────────────────────────────────────────────────────────

function lintFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  let inCodeBlock = false;
  let currentHeading = '';
  let inNegativeSection = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const lineNum = lineIdx + 1;
    const trimmed = rawLine.trim();

    // 追踪代码块状态
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // 追踪标题与负面案例上下文
    if (trimmed.startsWith('#')) {
      currentHeading = trimmed;
      inNegativeSection = /❌|扣分|禁忌|Blacklist|Anti-pattern|铁律|替换|对照/.test(currentHeading);
      continue;
    }

    // 豁免判定：自身文档在列举负面案例/表格反例时不自伤
    if (inNegativeSection && (trimmed.startsWith('|') || trimmed.startsWith('>') || trimmed.startsWith('- ❌'))) {
      continue;
    }
    if (trimmed.startsWith('❌') || trimmed.includes('❌') || trimmed.includes('Anti-pattern')) continue;
    if (trimmed.startsWith('|') && /扣分|假人|违规|删掉|反例/.test(trimmed)) continue;
    if (trimmed.startsWith('- `') || trimmed.startsWith('* `')) continue;

    // 逐规则检测
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0; // 重置正则状态
      let match;
      while ((match = rule.pattern.exec(rawLine)) !== null) {
        // 如果命中词被反引号包裹，视为语法展示，予以放行
        const before = rawLine.slice(0, match.index);
        const after = rawLine.slice(match.index + match[0].length);
        const quotesBefore = (before.match(/`/g) || []).length;
        const quotesAfter = (after.match(/`/g) || []).length;
        if (quotesBefore % 2 === 1 && quotesAfter % 2 === 1) {
          continue;
        }

        violations.push({
          lineNum,
          category: rule.category,
          matched: match[0],
          desc: rule.desc,
          hint: rule.hint,
        });
      }
    }
  }

  return violations;
}

// ── 递归收集文件 ─────────────────────────────────────────────────────────────

function collectFiles(targetPath) {
  const stat = statSync(targetPath);
  if (stat.isFile()) {
    return extname(targetPath).toLowerCase() === '.md' ? [targetPath] : [];
  }
  if (!stat.isDirectory()) return [];

  const results = [];
  const entries = readdirSync(targetPath);
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const fullPath = join(targetPath, entry);
    const subStat = statSync(fullPath);
    if (subStat.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (subStat.isFile() && extname(fullPath).toLowerCase() === '.md') {
      results.push(fullPath);
    }
  }
  return results;
}

// ── 主程序 ───────────────────────────────────────────────────────────────────

function main() {
  const targets = argv.slice(2).length > 0 ? argv.slice(2) : ['skills'];
  const allFiles = [];

  for (const target of targets) {
    try {
      allFiles.push(...collectFiles(target));
    } catch (err) {
      console.error(`⚠️ 无法读取目标路径: ${target} (${err.message})`);
    }
  }

  if (allFiles.length === 0) {
    console.log('ℹ️ 未找到任何待扫描的 Markdown 文件。');
    exit(0);
  }

  console.log(`\n🔍 开始执行表达规范与去 AI 味静态检查（共 ${allFiles.length} 个文件）...`);

  let totalViolations = 0;
  const fileReports = [];

  for (const file of allFiles) {
    const violations = lintFile(file);
    if (violations.length > 0) {
      totalViolations += violations.length;
      fileReports.push({ file, violations });
    }
  }

  if (totalViolations === 0) {
    console.log(`\n✅ 门禁通过！全部 ${allFiles.length} 个 Markdown 文件均无违规表达。\n`);
    exit(0);
  }

  console.error(`\n❌ 门禁拦截：共检测到 ${totalViolations} 处假人味与违规表达：\n`);

  for (const report of fileReports) {
    console.error(`📄 ${report.file}`);
    for (const v of report.violations) {
      console.error(`  Line ${v.lineNum}: [${v.category}] "${v.matched}"`);
      console.error(`    ↳ 为什么违规: ${v.desc}`);
      console.error(`    ↳ 修正建议: ${v.hint}\n`);
    }
  }

  console.error('🚫 请按上述修正建议修改后重试。\n');
  exit(1);
}

main();
