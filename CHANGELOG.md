# Changelog

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [2.1.0] - 2026-10-25

### 🚀 工业级场景补齐与自动化门禁进化

深化表达规范在复杂技术协作、公关事故与多平台社交场景下的交付标准：
- **新增 `technical-postmortem`**：严肃故障复盘与事故通报规范（时间线 UTC 白描、5 Whys 机制下钻、拒绝空洞公关套话、物理阻断防线与外部证据链）。
- **新增 `decision-and-rfc`**：架构决策（ADR）与技术方案（RFC）规范（第一性原理本质矛盾量化、权衡对齐 Trade-offs、弃用选项墓碑区、可证伪推翻红线）。
- **新增 `executive-briefing`**：对业务负责人/Owner 极简汇报与卡单拍板规范（严格二分法：仅限【✅ 已完成】与【⏸ 仅剩拍板项】，将开放性请示收敛为互斥选项的代价对齐）。
- **扩展 `platform-voices` 全平台说说扣分清单**：
  - 新增 **Reddit**（r/programming、r/webdev）社区心智、自来水发帖范式与 6 项扣分清单（零营销耐受、TL;DR 契约）；
  - 新增 **掘金** 技术沸点与踩坑手记范式与 6 项扣分清单（现场抓包、拒绝纯水贴与泛泛而谈）；
  - 补充 **小红书** 笔记/说说 6 项扣分清单（大情绪抓手、图文滑滑卡联动、互动单选题、拒绝假人鸡汤）；
  - 补充 **Twitter/X** 短推/Thread 6 项扣分清单（前两行反常识、第一人称“我”、主推避开裸链接防降权、Thread #1 即刻交付）。
- **扩展 `atomic-matrix`**：5D 矩阵新增角色原型 `P6·技术架构师/工程决策者`、场域 `M6·Reddit`、`M7·掘金`，场景意图 `S6`~`S8`，补充 4 组实战高频配方。
- **新增 `scripts/lint-writing.mjs`**：零依赖 Node.js 静态检查门禁工具，机械扫描 Markdown 假人过渡词、机械排比、高中作文腔与空洞正能量结尾，已接入 GitHub Actions CI 与 npm test。
- **更新 `install.sh`**：分发清单扩容至 9 个 skills。

## [2.0.0] - 2026-09-26

### 🚀 重大重构：从「宏观流程」演进为「5D 原子表达矩阵」

打破单一粗颗粒度流程限制，将表达拆解为可任意拼装的原子积木：
- **新增 `platform-voices`**：全平台表达风格与媒介心智分册（网易云音乐情怀通感、小红书大情绪生活唠嗑、Twitter/X 独立极客反常识、GitHub 客观边界、微信公众号深度长文）。抽象解耦，不硬编码私有实体，支持任意创作者原型。
- **新增 `scenario-openers`**：场景接待词、破冰与去 AI 味真实表达规范（消除机器假人论文腔，提供私信接待、客诉安抚、社区 Issue 回应、网易云神评开场、小红书痛点钩子等真人声腔语料）。
- **新增 `atomic-matrix`**：5D 原子表达组合矩阵速查（[谁] × [在哪] × [为什么说] × [口吻温度] × [第一句接待词] = 零 AI 味精准表达）。
- **新增 `install.sh` 一键全 Agent 智能接入脚本**：支持一行命令全自动建立软链接至 `~/.agents/skills` 全局中心、`~/.claude/skills`、`~/.codex/skills`、`~/.dsh` 以及本地 GUI（`~/.gemini/config/skills` Antigravity IDE），彻底替代繁琐的复制命令，源码修改即时全端生效。
- **更新 `how-to-write`**：总纲链接全新分册与原子矩阵，形成全闭环。

---

## 历史（按时间倒序）

- `ae266d4` — docs: 补生态位分工表（说什么 / 长什么样 / 怎么念 / 在哪写）
- `c9eae12` — docs: 补与 facet 的重复定义核对结论
- `b68d609` — feat: talk-skills 首版 —— 表达规范四步法 + 4 个 skill

### 4 个子 skill（首版内容）

- `how-to-write` —— 写前定调（结论先行 / SCQA / MECE / 结论 vs 论述）
- `peer-facing-writing` —— 面向同行 / 评审的表达姿态
- `talk-text-review` —— 文字稿逐段体检
- `talk-visual-review` —— 视觉稿（slide / 长图 / 海报）逐屏体检

---

完整 commit 列表见 `git log`。本仓不打 tag（早期迭代）。