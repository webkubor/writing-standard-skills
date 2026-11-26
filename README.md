<h1 align="center">writing-standard-skills</h1>

<p align="center">
  <img src="assets/hero.svg" alt="内核 → 架构 → 回复：简单背后是不简单" width="900" />
</p>

<p align="center">
  不止去 AI 味——教 AI 人情世故：哪句话会得罪人、对上汇报和对同事吐槽是两套语法、换个平台要换一副心智。<br/>
  回复是流出来的，不是憋出来的：底下有内核和架构，表面才敢简单。
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-0f766e.svg" /></a>
  <img alt="Skills" src="https://img.shields.io/badge/skills-19-111827.svg" />
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-ready-d97706.svg" />
  <img alt="Codex" src="https://img.shields.io/badge/Codex-ready-111827.svg?logo=openai&logoColor=white" />
  <img alt="Hermes" src="https://img.shields.io/badge/Hermes-ready-7c3aed.svg" />
  <img alt="OpenCode" src="https://img.shields.io/badge/OpenCode-ready-0ea5e9.svg" />
</p>

**`writing-standard-skills` 是集合名，不是 skill 名。** 装进 Agent 的是下面 19 个 skill，目录名即触发名；表里最后一行是参考文档，不会被触发。

---

## 30 秒看懂

写文档、提单、发动态、做客诉接待——内容对了但没人看完，或者看完了充斥着一股 AI 假人味，通常不是内容问题，是这四件事没按顺序做：

```
① 搭骨架   原词说事 · 结论先行 · SCQA 四句 · MECE 不重不漏
② 定读者   给人 or 给 agent；对上 or 对同侧；契合特定平台受众心智
③ 调语气   归因情境 · 终稿自包含 · 去 AI 味 · 拒绝空洞升华 · 允许被推翻
④ 当读者   以第一次看的人的身份通读，带清单查错
```

跳过 ④ 的实测代价：一份 9918 字的技术报告，通读后揪出 20 处问题，**19 处是通读才发现的**——内容错位挂到邻节、引用已删章节、同一份文档两处结论互相打脸。脚本只能扫出词面残留。

## 两层结构：常驻身份 + 按需技能

「说中文、说人话、别老停下来问、有点脾气」不是某一篇 skill 能教出来的——skill 是**用的时候才读**的，而这几件事必须每轮在场。所以分两层：

| 层 | 内容 | 加载方式 |
|---|---|---|
| **常驻内核** [`identity/kernel.md`](identity/kernel.md) | 语言、说人话、持续推进、脾气、对话红线、技能路由 | 每轮都在；`install.sh` 写进四个 Agent 的常驻配置 |
| **理论后盾** [`identity/dialogue-foundations.md`](identity/dialogue-foundations.md) | 非暴力沟通、Grice 四条准则、言语行为理论 | 按需查阅，不常驻 |
| **按需技能** `skills/` | 19 个具体文体的写法与判据 | 写东西前按场景选一个读 |

内核设 60 行硬上限——常驻内容一长，每轮 token 就被吃掉；细则留在后盾和 skill 里。改内核后重跑 `./install.sh` 四端同时生效，`npm run check:kernel` 校验漂移（标记块由脚本独占，别手改）。

## 场景长什么样

完整回复库见 [`examples/scenarios.md`](examples/scenarios.md)，每条都标了背后用了哪条框架。三条样例：

> **老板问进度**：做完了，已上线。就一个点等你定：旧入口今天关还是留一周？我倾向关。

> **朋友接梗**：嘎嘎嘎嘎嘎嘎(≧▽≦) 这个我信！我上周也这样，盯着页面看了十分钟才发现是自己缓存没清，纯纯白折腾 (；一_一) 哈哈哈哈

> **客诉承接**：换我我也得骂两句——按文档走还踩坑，白耽误你时间。我复现了，确实是我们的锅。先给你个能直接用的绕法，根因今晚修，修完我第一时间回你。

## 十九个 skill 与原子矩阵

目录名 = 触发名。装上后你的 Agent 认的是左边这一列。

| skill（触发名） | 管什么 | 什么时候用 |
|---|---|---|
| **[how-to-write](skills/how-to-write/)** | 总纲：上面四步的完整方法 | 写任何要给别人看的文字之前 |
| **[account-custody](skills/account-custody/)** | 账户托管前置检查：认平台→读人设→对口径→核环境（IP属地一致性） | Agent 替人接管社交账户、代运营发帖之前 |
| **[peer-facing-writing](skills/peer-facing-writing/)** | 对同事的书面沟通：提单骨架、逐句替换表 | 写 issue、评审意见、跨团队报告 |
| **[technical-postmortem](skills/technical-postmortem/)** | 严肃事故复盘与故障通报：时间线白描、5 Whys 机制下钻、物理防复发措施 | 线上故障、服务中断、负面公关通报时 |
| **[decision-and-rfc](skills/decision-and-rfc/)** | 架构决策（ADR）与技术提案：本质矛盾量化、代价显式化、墓碑方案、推翻红线 | 架构评审、技术选型论证、重构立项时 |
| **[executive-briefing](skills/executive-briefing/)** | 对负责人极简汇报：仅限【✅已完成】/【⏸拍板项】，互斥选项代价对齐 | 给老板、业务决策者与 Owner 汇报时 |
| **[platform-voices](skills/platform-voices/)** | 全平台表达风格分册：小红书/X/Reddit/掘金/网易云/GitHub/公众号，附说说扣分清单 | 针对特定平台的受众心智发帖与创作时 |
| **[wechat-article-flow](skills/wechat-article-flow/)** | 公众号图文生产流程：选题拷问 → 文体骨架 → 标题判据 → 正文 → 配图与排版交接 → 合规自查 → 交付门禁 | 公众号从选题到草稿箱的完整流程，需要逐步确认与发布门禁时 |
| **[scenario-openers](skills/scenario-openers/)** | 场景接待词、破冰与去 AI 味真实表达规范 | 客诉安抚、私信接待、神评开场、彻底消除 AI 论文腔 |
| **[life-comms](skills/life-comms/)** | 生活类回复统一规范：纯文本零排版、短句口语 3-5 行、提醒三段式、回执、健康守边界、长任务汇报 | 跟家人、伴侣、亲近的人日常说话、发提醒、回执、关心问候时 |
| **[talk-text-review](skills/talk-text-review/)** | 讲稿姿态验收：这份稿是「我教你们」还是「我跟你们聊」 | 对同级或高手分享之前 |
| **[talk-visual-review](skills/talk-visual-review/)** | 讲稿视觉验收 | 出片之前 |
| **[task-reporting](skills/task-reporting/)** | 任务回执与状态汇报：状态一行 + 产物/证据/未决三段，阶段不混报 | 代码、文档、巡检、长任务交付回执与周报条目 |
| **[notification-writing](skills/notification-writing/)** | 通知与告警表达：四要素、三档严重级别、成功/失败/阻塞模板、未送达补偿 | 告警、任务提醒、恢复通知与回执 |
| **[release-notes](skills/release-notes/)** | 发布说明与 CHANGELOG：标题、五段结构、体裁区别、SemVer 指针 | 写 Release Note、CHANGELOG 或版本升级说明 |
| **[release-notes-tool](skills/release-notes-tool/)** | 开源发版说明生成工具：识别 GitHub/GitLab，把提交历史转成中文五段式发布说明，剔除过程性提交 | 仓库发版、要写 Release 正文或更新 CHANGELOG |
| **[ticket-copy](skills/ticket-copy/)** | 单据与协作记录：issue、MR/PR、依赖单、复现步骤、验收 checkbox、Refs | 提单、复现、交接和代码评审记录 |
| **[ui-copy](skills/ui-copy/)** | 界面文案：按钮、标题、空态、错误、超长文本、卡片 | 写产品界面的用户可见文字 |
| **[persona-voice](skills/persona-voice/)** | 人称、身份边界、评论/回复/CTA 口吻 | 公开内容、评论、私信和署名表达 |

参考文档（**不是 skill，不会被自动触发**，需要时手动查阅）：

| 文档 | 内容 |
|---|---|
| **[atomic-matrix.md](skills/atomic-matrix.md)** | [5D 原子表达组合矩阵](skills/atomic-matrix.md)：像拼积木一样拼装 [谁]×[在哪]×[场景]×[口吻]×[接待词] |
| **[scenarios.md](examples/scenarios.md)** | 场景回复库：14 个真实场景，每条标出背后用的框架 |

### 自动化去 AI 味门禁（Linter）

自带开箱即用的静态检查脚本 `scripts/lint-writing.mjs`，无第三方依赖，可直接作为 Git pre-commit hook 或接入 CI，机械拦截假人过渡词、机械排比、高中作文腔与空洞正能量结尾：

```bash
node scripts/lint-writing.mjs skills/   # 本地自检
npm test                                # lint + release-notes + 内核约束
npm run check:kernel                    # 校验四端常驻内核没漂移
```

## 一键接入全 Agent 与本地 GUI

智能安装脚本一秒软链接接入 `~/.agents/skills` 全局中心、**Claude Code**、**OpenAI Codex**、**Hermes**、**OpenCode** 以及本地 GUI（Antigravity IDE），并写回常驻身份内核：

```bash
# 已在本地仓库目录下
./install.sh

# 远程一行
curl -fsSL https://raw.githubusercontent.com/webkubor/writing-standard-skills/main/install.sh | bash
```

远程安装首次执行会把源码缓存到 `~/.local/share/writing-standard-skills`，各 Agent 的软链接都指向这份本地源码；以后修改源码即时生效，无需重复安装。常驻内核首次写入会在目标文件旁留 `.bak-wss-kernel` 备份。

> 软链接直连模式：源码改了所有 Agent 实时生效。其他 Agent 与配置细节见 [AGENTS.md](AGENTS.md)。

## 它不管什么

表达拆成四段，本仓只管第一段，其余各有归属，互不重复定义：

| 说什么 | 长什么样 | 怎么念 | 在哪写 |
|---|---|---|---|
| **writing-standard-skills** | [facet](https://github.com/webkubor/facet) | [voxflow](https://github.com/webkubor/voxflow) | [typora-Bloom-theme](https://github.com/webkubor/typora-Bloom-theme) |
| 结构 · 语气 · 归属 | 字阶 · 留白 · 分页 · 渲染 | 声音设计 · 戏感 · 停顿 | 编辑器环境 |

一句话判归属：「该说什么、先说哪句、这话得罪人吗」→ 本仓；「字号多大、留多少白」→ facet；「这句怎么念」→ voxflow。完整分工见 [BOUNDARY.md](BOUNDARY.md)。

## 为什么规则长这样

语气部分的每条规则都挂着一个心理学机制，不是「礼貌一点」这种手感：

- **基本归因错误** → 别写「测试方法不对」，写「这个坑在页面上看不出来」（归因到情境，不归因到人）
- **面子威胁** → 命令式触发防御，对方先保护自尊、后处理信息
- **逆火效应** → 直接说「你错了」会让人更坚持，尤其在有第三方围观的单据里
- **自曝降防御** → 同一个坑自己也踩过，先写自己踩过

对话底层另有三套框架撑着（[展开](identity/dialogue-foundations.md)）：非暴力沟通管「先接情绪再办事」，Grice 四条准则管「说多少、清不清楚」，言语行为理论管「这句话落地算什么」。

结构部分用金字塔原理（Barbara Minto）：结论先行、以上统下、归类分组（MECE）、逻辑递进。

MIT License.
