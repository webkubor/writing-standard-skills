# AGENTS.md

给 AI agent 的使用与维护指引。人只需要读 [README](README.md)。

## 一键全 Agent 与本地 GUI 接入

直接跑自带的 `./install.sh`，全自动建立软链接：

```bash
./install.sh
# 或
curl -fsSL https://raw.githubusercontent.com/webkubor/writing-standard-skills/main/install.sh | bash
```

| Agent / 运行时 / GUI | 自动接入路径 | 说明 |
|---|---|---|
| **全局标准中心** | `~/.agents/skills/` | 全局基础底座（包含 DSH 统一挂载） |
| **Claude Code** | `~/.claude/skills/` | 软链接直连，修改实时生效 |
| **OpenAI Codex** | `~/.codex/skills/` | 软链接直连，修改实时生效 |
| **本地 GUI (Antigravity IDE)** | `~/.gemini/config/skills/` | 软链接直连，GUI 侧栏即刻读取 |
| **Cursor** | `.cursor/rules/` | 内容复制进 rules（Cursor 暂不读全局目录） |


## 什么时候该触发哪个

判断顺序：**先看产物形态，再看读者**。

```
要写的是给别人看的文字
├─ 不确定从哪下手        → how-to-write（总纲，四步顺序）
├─ 需要拼装特定人设/场域  → atomic-matrix（5D 积木矩阵，自由组合）
├─ 特定平台社交内容创作  → platform-voices（网易云/小红书/X/GitHub/公众号媒介心智）
├─ 寻找真实接待词/开场白  → scenario-openers（私信接待/神评开场/极客钩子/去AI味）
├─ GitLab/GitHub 单据、评审意见、跨团队报告
│                        → peer-facing-writing
├─ 分享稿、演讲稿、长文   → talk-text-review（先验姿态）
│                          出片前再跑 talk-visual-review
└─ 排版/渲染/出 PDF      → 不在本仓，见 BOUNDARY.md，用 facet
```

**反触发**：写给自己 owner 的对话回复不适用本仓——那边要极简结论，客套是噪声。本仓管的是「给同侧和对外」的表达。

## 维护约定

1. **一条规则必须挂一个机制或一个真实案例。** 只写「要礼貌」「要清晰」这种手感的条目不收——无法判断违没违反的规则等于没有。
2. **案例要带代价数字。** 「通读后揪出 20 处问题，19 处靠通读发现」比「建议通读」有用得多。
3. **不写排版规范。** 字号、留白、分页阈值属于 facet 的 `docs/design-spec.md`，两处都写必然漂移。
4. **总纲与分册的关系**：`how-to-write` 是四步骨架，其余是分册展开。改分册里的原则时，检查总纲要不要同步；总纲只收「顺序」和「判据」，不收细则。
5. **新增 skill 前先答**：它解决的问题在现有四个里有没有位置？没有才新开。

## 规则的依据来源

- 结构部分：金字塔原理（Barbara Minto）——结论先行、以上统下、归类分组（MECE）、逻辑递进；SCQA 用于开篇
- 语气部分：基本归因错误、面子威胁（face threat）、逆火效应（backfire effect）、自我暴露（self-disclosure）、心理逆反（reactance）、出丑效应（pratfall effect）
- 通读与重写阈值：实战踩坑，见各 skill 的案例段
