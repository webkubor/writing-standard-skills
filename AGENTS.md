# AGENTS.md

给 AI agent 的使用与维护指引。人只需要读 [README](README.md)。

## 一键全 Agent 与本地 GUI 接入

直接跑自带的 `./install.sh`，全自动建立软链接：

```bash
./install.sh
# 或
curl -fsSL https://raw.githubusercontent.com/webkubor/writing-standard-skills/main/install.sh | bash
```

远程一行安装首次执行时会把源码缓存到 `~/.local/share/writing-standard-skills`，后续软链接指向这份本地源码。

| Agent / 运行时 / GUI | 自动接入路径 | 说明 |
|---|---|---|
| **全局标准中心** | `~/.agents/skills/` | 全局基础底座（包含 DSH 统一挂载） |
| **Claude Code** | `~/.claude/skills/` | 软链接直连，修改实时生效 |
| **OpenAI Codex** | `~/.codex/skills/` | 软链接直连，修改实时生效 |
| **本地 GUI (Antigravity IDE)** | `~/.gemini/config/skills/` | 软链接直连，GUI 侧栏即刻读取 |
| **Cursor** | `.cursor/rules/` | 内容复制进 rules（Cursor 暂不读全局目录） |


## 常驻内核（identity/kernel.md）

`identity/kernel.md` 是**常驻身份层**的单一真源：语言、说人话、持续推进、脾气、技能路由。
它和 `skills/` 的分工是：内核每轮在场，技能按需加载。内核有 60 行硬上限，别把分册细则塞进去。

- 改内核 → 改 `identity/kernel.md`，**不要手改各 Agent 配置里的标记块**。
- 改完跑 `./install.sh` 写回四端（Claude / Codex / Hermes / OpenCode），再跑 `npm run check:kernel` 核对。
- `install.sh` 首次写入会在目标文件旁留 `.bak-wss-kernel`，块外内容一概不动。
- 内核只留压缩操作口；理论出处在 `identity/dialogue-foundations.md`（非暴力沟通 / Grice 四条 / 言语行为理论），按需读，不常驻。

## 什么时候该触发哪个

判断顺序：**先看产物形态，再看读者**。

```
要写的是给别人看的文字
├─ 不确定从哪下手        → how-to-write（总纲，四步顺序）
├─ 需要拼装特定人设/场域  → atomic-matrix（5D 积木矩阵，自由组合）
├─ 社交平台内容与说说    → platform-voices（小红书/X/Reddit/掘金/网易云/公众号，附扣分清单）
├─ 公众号从选题到草稿箱  → wechat-article-flow（流程门禁；风格看 platform-voices，排版数值看 facet）
├─ 寻找真实接待词/开场白  → scenario-openers（私信接待/神评开场/极客钩子/去AI味）
├─ 对亲近之人的日常私聊/提醒
│                        → life-comms（纯文本短句、提醒三段式、回执、健康守边界、长任务汇报）
├─ GitLab/GitHub 单据、评审意见、跨团队报告
│                        → peer-facing-writing
├─ 线上故障通报、事故复盘 → technical-postmortem（时间线白描、5 Whys 机制下钻）
├─ 架构方案与技术立项论证 → decision-and-rfc（权衡矩阵、墓碑方案、推翻红线）
├─ 任务回执、状态与周报条目 → task-reporting（状态一行 + 产物/证据/未决三段）
├─ 告警、通知、成功/失败/阻塞回执 → notification-writing（四要素与送达补偿）
├─ Release Note、CHANGELOG、版本说明 → release-notes（五段结构与 SemVer）
│                          仓库发版要现成正文 → release-notes-tool（识别 GitHub/GitLab，跑脚本生成）
├─ issue、MR/PR、依赖单、复现与验收 → ticket-copy（单据骨架、checkbox、Refs）
├─ 按钮、标题、空态、错误、卡片等界面文字 → ui-copy
├─ 人称、身份、评论/回复/CTA 口吻 → persona-voice（平台细则见 platform-voices）
├─ 给老板、负责人极简汇报 → executive-briefing（仅限✅已完成/⏸拍板项，选项代价对齐）
├─ 分享稿、演讲稿、长文   → talk-text-review（先验姿态）
│                          出片前再跑 talk-visual-review
└─ 排版/渲染/出 PDF      → 不在本仓，见 BOUNDARY.md，用 facet
```

**对上极简与对同侧沟通**：对同侧同事用 `peer-facing-writing`（留余地、给台阶、情境归因）；任务回执按 `task-reporting` 写状态一行与三段证据；给负责人/Owner 汇报在 `task-reporting` 格式上叠加 `executive-briefing` 的 `✅/⏸` 与拍板项。两者场域完全解耦。

## 维护约定

1. **一条规则必须挂一个机制或一个真实案例。** 只写「要礼貌」「要清晰」这种手感的条目不收——无法判断违没违反的规则等于没有。
2. **案例要带代价数字。** 「通读后揪出 20 处问题，19 处靠通读发现」比「建议通读」有用得多。
3. **不写排版规范。** 字号、留白、分页阈值属于 facet 的 `docs/design-spec.md`，两处都写必然漂移。
4. **总纲与分册的关系**：`how-to-write` 是四步骨架，其余是分册展开。改分册里的原则时，检查总纲要不要同步；总纲只收「顺序」和「判据」，不收细则。
5. **新增 skill 前先答**：它解决的问题在现有分册里有没有位置？没有才新开。

## 规则的依据来源

- 结构部分：金字塔原理（Barbara Minto）——结论先行、以上统下、归类分组（MECE）、逻辑递进；SCQA 用于开篇
- 语气部分：基本归因错误、面子威胁（face threat）、逆火效应（backfire effect）、自我暴露（self-disclosure）、心理逆反（reactance）、出丑效应（pratfall effect）
- 通读与重写阈值：实战踩坑，见各 skill 的案例段
