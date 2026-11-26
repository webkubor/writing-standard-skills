# Changelog

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### 新增特性
- 新增 **常驻身份内核** `identity/kernel.md`：语言（中文）、说人话、持续推进（A/B/C 停手）、脾气档案、技能路由五块，单一真源，60 行硬上限。
- `install.sh` 新增幂等写入：把内核以 `<!-- wss-kernel:begin/end -->` 标记块写进 Claude Code / Codex / Hermes / OpenCode 的常驻配置，块外内容不动，首次写入留 `.bak-wss-kernel` 备份。
- 新增 `scripts/check-kernel-sync.mjs`（`npm run check:kernel`）：校验四端内核块与真源一致，CI 下缺文件跳过、漂移报错。
- 内核新增「对话红线」：代码细节与过程不外放、验证证据仍要给、进度节点必须说、能开子 Agent 就开后台保持主会话畅通。
- 内核新增篇幅约束：问一句答一句；专业术语必要时才用，首次出现配一句人话解释。
- 新增架构层 `identity/dialogue-foundations.md`：非暴力沟通、Grice 合作原则、言语行为理论三套框架及叠加顺序；内核只保留三行压缩操作口，`install.sh` 挂载后盾文档供按需查阅。
- 新增 `examples/scenarios.md`：14 个真实场景的成品回复，每条标出背后用的框架；客诉、接梗、反驳等按对话红线与底层框架修正过。
- README 重写：补 `assets/hero.svg` 三层结构图、场景样例、四端接入说明；链接全部指向真实文件。
- `install.sh` 安装目标补齐到 CortexOS 认可的九个运行时（增加 Cursor / OpenCode / DSH / Magpie / Hermes），并覆盖 `~/.hermes/profiles/*/skills` 下每个 profile；修复 `cs skill install --list` 显示已装、实际缺 3 个 skill 的漂移。修复后九端实测各 19/19。
- 新增远程安装器 `install-remote.sh` 与清单 `skills-manifest.json`：服务器无本地源码，安装只走 GitHub 链接 clone 到绝对缓存目录再装，先校验清单齐全。README 补远程一行安装命令。

### 文档同步
- `README.md` 补「两层结构：常驻身份 + 按需技能」；`AGENTS.md` 补内核维护约定；`llms.txt` 补 `identity/` 导览。

### 缺陷修复
- 修复 `install.sh` 远程一行安装从任意目录执行时找不到 `skills/` 的问题：首次安装会把源码缓存到 `~/.local/share/writing-standard-skills`。
- 安装脚本改为从源码自动发现包含 `SKILL.md` 的目录，并从 `package.json` 读取版本号，避免技能清单和安装提示落后于仓库。

## [2.6.0] - 2026-11-19

> **一句话摘要**：补齐说人话、终稿自包含与长任务持续推进三类官方提示词门禁。

### 新增特性
- `how-to-write` 新增「原词说事，终稿自包含」：沿用用户与资料来源的术语，必要时保留精确领域语言；相关内容按主动语态和推理顺序前置关键点，最终答案脱离中途更新也能独立读懂。
- `task-reporting` 新增终稿自包含和持续推进要求：最终答案不带推理过程、工具调用或子 agent 简写；授权范围内有下一步就继续执行，仅在范围重大变化、过不去的坎、需要拍板或不可逆操作时停手。

### 文档同步
- `life-comms` 的长任务汇报引用 `task-reporting` 的交付结论与停手口径；更新 README 的 `how-to-write` 能力描述。

### 安装与升级
```bash
./install.sh
```

## [2.5.0] - 2026-11-19

> **一句话摘要**：新增任务回执、通知、发布说明、单据、界面和对外口吻六个表达分册。

### 新增特性
- 新增 `task-reporting`，统一任务回执、成功/失败/阻塞回执、无变化回执和周报条目的证据分段。
- 新增 `notification-writing`，覆盖告警四要素、严重级别、未送达补偿与接受回执边界。
- 新增 `release-notes`，覆盖 Release Note 标题、五段结构、CHANGELOG 体裁区别与 SemVer 指针。
- 新增 `ticket-copy`、`ui-copy`、`persona-voice`，分别规范协作单据、界面文案与人称身份口吻。

### 体验与性能优化
- 更新中英文入口文档、技能索引、安装清单和原子矩阵，使 18 个 skill 可被统一发现。

### 缺陷修复
- 统一五类必停项与交付汇报口径，避免把 Run 完成、合并、部署和业务验收混报。

### 破坏性变更与迁移
- 无破坏性变更（向后兼容）。

### 安装与升级
```bash
./install.sh
```

## [2.4.0] - 2026-11-18

### 🚀 生活类回复收敛为 life-comms
- **新增 `life-comms` 并移除 `personal-companion`（并入）**：生活类回复统一规范——私聊窗口里的提醒、回执、关心问候、健康话题、长任务汇报一套规则收口。新增「消息纯文本、说明书可结构化」「长度分场景」「回执只说结果」「长任务汇报四件事」「用药先核对处方药盒剂量、漏服不替对方决定」等口径，原 personal-companion 的语气、提醒三段式、健康红线、被纠正吸收全部并入。
- **三条冲突取舍**：其一，发进聊天窗口的消息一律纯文本、不用表格，给对方看的规则文档与演示页可用表格或交互页面，其中展示的示例消息仍按纯文本写；其二，日常提醒、回执、问候 3-5 行硬上限，健康判断依据、验收结论与风险可以写长但仍纯文本；其三，emoji 最多一个且只放问候那一句，不作标题、不作分隔。
- **同步引用**：`README.md` / `README.en.md` / `AGENTS.md` / `install.sh` / `atomic-matrix` / `how-to-write` 全部改指 `life-comms`，旧 skill 目录删除。
- **数量口径不变，仍为 12 个 skill**（新增 1、移除 1）。

## [2.3.0] - 2026-11-18

### 公众号图文流程沉淀为通用 skill
- **新增 `wechat-article-flow`**：把公众号从选题到草稿箱的可复用流程独立成 skill——输入四问、选题拷问、文体骨架、标题前 15 字与承诺兑现、正文密度、配图确认、排版交接、合规自查、交付清单与发布门禁。只沉淀流程与门禁，账号资料、密钥、内部路径、个人 IP 红线与账号数据一律不进公开仓。
- **明确边界**：平台语气继续归 `platform-voices`，排版数值继续归 `facet`；新 skill 不重写风格分册，也不写字号/留白/配色。
- **同步数量口径为 12 个 skill**：`README.md` / `README.en.md` / `llms.txt` / `package.json` / `install.sh`。
- **更新 `AGENTS.md`** 触发树：新增公众号完整流程分支。
- **更新 `how-to-write`** 相关 skill 列表：补 `wechat-article-flow` 指针。

## [2.2.0] - 2026-11-17

### 🚀 亲近之人私聊场景补齐与数量口径归一
- **新增 `personal-companion`**：对家人、伴侣、至交等亲近的人（含陪伴型助理对自己的主人）日常私聊表达规范——口语短句带语气词、3-5 行封顶、纯文本零排版（禁编号/装饰符号/表格/技术细节）、提醒三段式「问候-动作-补充」、健康话题只关心不变相诊断（拿不准建议问医生、不制造焦虑）、被纠正当场改并固化成规则，附正反例与发送前自检清单。与 `scenario-openers`（陌生用户接待）、`platform-voices`（公开平台内容）完全解耦。
- **扩展 `atomic-matrix`**：场景意图新增 `S9·对亲近之人的日常私聊与提醒`，口吻调性新增 `T5·温暖口语`，配方库新增配方 09（P2 × S9 × T5）。
- **同步数量口径为 11 个 skill**：`README.md` / `README.en.md`（含补齐 en 表缺失的 `account-custody` 行）/ `llms.txt` / `package.json` 描述。
- **更新 `install.sh`**：分发清单扩容至 11 个 skills。
- **更新 `AGENTS.md`**：触发树新增「对亲近之人的日常私聊/提醒」分支。

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
