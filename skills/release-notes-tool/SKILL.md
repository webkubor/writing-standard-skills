---
name: release-notes-tool
version: "1.0.0"
description: 开源发版说明生成工具（GitHub/GitLab 通用）：自动识别远端是 GitHub 还是 GitLab，按 Conventional Commits 把提交历史翻译成中文五段式发布说明（新增特性/体验与性能优化/缺陷修复/破坏性变更与迁移/安装与升级），剔除 test/chore/ci/release 等过程性提交，同主题多条自动归组。触发："写 release note / 生成发布说明 / 更新日志 / changelog / 发版文案 / release 正文 / 版本说明"。
---

# 开源发版说明生成工具

## 适用范围

把一个仓库的提交历史变成**面向陌生用户的中文发布说明**。管「发布说明正文怎么写」，不管「该不该发版、版本号怎么定、包怎么发布」——那三件事另有流程。

配套 `release-notes` skill：那份管**体裁与判据**（哪些话该写、五段结构、SemVer 方向），这份管**执行**（把提交历史跑成正文）。先读 `release-notes` 判据，再用本工具产出，最后按 `release-notes` 的自检清单复核。

## 为什么需要工具

自动发版工具（release-please / GitLab 模板）生成的是**提交清单**，不是发布说明。实际产出的典型问题：

- 中英混杂：`release: v0.28.0 — 15 套配色全量可选…` 与 `fix: keep approval buttons out of the send-bead style` 并列；
- 同一标题挂多个 SHA，读者看不懂哪条是哪条；
- 过程性提交混进「Bug Fixes」：`test: slot 契约对齐`、`prepare v0.28.0 release media`、`chore: 删除死代码`；
- 缺段落：没有「破坏性变更」「安装与升级」，读者不知道该不该升、怎么装；
- 标题只有版本号，没有一句话核心价值。

读者是**要升级的陌生人**。他关心三件事：变了什么、对我有没有影响、怎么装。工具围绕这三件事组织正文。

## 用法

工具脚本在仓库的 `scripts/release-notes.mjs`。已安装到本机 Agent 时，`scripts/` 目录被链在
`~/.agents/skills/writing-standard-skills-scripts/`（各 Agent 的 skills 目录同构），从 skill 目录出发用：

```bash
# 脚本位置（已安装到本机）
TOOL=~/.agents/skills/writing-standard-skills-scripts/release-notes.mjs
# 或在 skill 目录内用相对路径
TOOL=../writing-standard-skills-scripts/release-notes.mjs
```

在仓库内开发时直接用仓库根的 `scripts/release-notes.mjs`。

```bash
# 1. 先识别平台与仓库（工具会打印平台、包名、版本、安装命令）
node "$TOOL" detect

# 2. 生成发布说明（--from 是上一个版本 tag）
node "$TOOL" plan --from v0.27.0 --to v0.28.0

# 3. 带 JSON 输出，便于程序化处理
node "$TOOL" plan --from v0.27.0 --to HEAD --json

# 4. 直接追加进 CHANGELOG.md
node "$TOOL" plan --from v0.27.0 --to v0.28.0 --write CHANGELOG.md
```

### 常用参数

| 参数 | 作用 |
|---|---|
| `--version <v>` | 版本号（默认取 `--to` 的 tag，其次 `package.json`） |
| `--date <YYYY-MM-DD>` | 发布日期（默认今天） |
| `--summary <一句话>` | 手动指定核心价值（默认自动推断） |
| `--install <命令>` | 覆盖安装命令 |
| `--platform github\|gitlab` | 手动指定平台（默认自动识别） |
| `--include-internal` | 连过程性提交也列出（单列「内部变更」段） |
| `--write <file>` | 写入文件（新版本插到最上面） |

## 平台识别

工具读 `git remote get-url origin`，按**远端域名**判定，不靠猜：

| 远端含 | 判定 |
|---|---|
| `github.` | GitHub |
| `gitlab.` / `gitlab.com` | GitLab |
| `gitee.com` / `codeberg.` / `bitbucket.` | 对应平台 |

识别结果决定安装段写法（npm 包 → `npm install -g <包名>@latest`）、仓库链接格式，以及自建 GitLab（`gitlab.<域名>`）与 gitlab.com 的区分。自建 GitLab 的 Release 页面路径、权限模型与 github.com 不同，发布命令也不一样——**先确认平台再动手**。

## 五段结构

```
# v<版本> — <一句话核心价值>

> **一句话摘要**：…

### 新增特性
### 体验与性能优化
### 缺陷修复
### 破坏性变更与迁移
### 安装与升级
```

- 空段落写「本版本无此类变化」，不省略——读者要知道是「没有」还是「漏了」。
- 无破坏性变更时显式写「无破坏性变更（向后兼容）」。
- 有破坏性变更时每条给：Before → After、受影响对象、迁移动作。

**可选第六段「本版要点」**：仅当存在 release 版本说明提交（`feat(release): v0.28.0 — …`）时出现。
它收录该提交 body 里人工写的版本条目——那是本版核心价值，原本就该给读者看。
没有这类提交时不出现，读者不会以为少了内容。

## 提交归类规则

| 提交类型 | 去向 |
|---|---|
| `feat` / `feature` | 新增特性 |
| `fix` / `bugfix` / `hotfix` / `revert` / `security` | 缺陷修复 |
| `perf` | 体验与性能优化 |
| 含 `!` 或 body 有 `BREAKING CHANGE:` footer | 破坏性变更与迁移 |
| `test` / `ci` / `chore` / `docs` / `style` / `refactor` | **不进正文** |

`deps` / `build` **要进正文** —— 依赖升级与运行时要求变化是用户能感知的
（升级要求变了），整条排除会让读者以为没变化。

### 流程性提交排除

scope 属于 `release` / `test` / `ci` / `docs` / `chore` / `workflow` / `bot` 的提交不进正文；
标题是裸版本号形态（`v1.2.3 — …`）或以 `prepare … release` / `bump version` / `release v1.2.3` 开头的也不进。

⚠️ 不能用裸 `^release` 前缀去砍：`feat: release notes 面板上线` 的 subject 是
「release notes 面板上线」，会被误杀成流程性提交。

### 版本说明提交的特殊处理

`feat(release): v0.28.0 — 15 套配色全量可选…` 这类提交：

- **不进**正文的特性/修复段（会造成「这个版本自己又发布了一次」）；
- 但它的 **body 里常有手工写的版本条目**（每条带 `fixes #号`），那是本该给读者看的内容，
  工具把它们收进「本版要点」段 —— 这是版本核心价值所在，丢了正文就空了；
- 只认**版本说明提交**的 body。普通 `fix`/`feat` 的 body 里也有 bullet，
  那是给开发者看的实现说明，混进正文会污染内容。

## 版本号真源

优先级：`--version` > `--to` 的 tag > `package.json`。

只读 `package.json` 会写错版本 —— 真实仓库里它已经 bump 到下一个版本，
用它给上一区间生成说明会把 CHANGELOG 标成错的版本号。

## CHANGELOG 写入

`--write` 把新版本小节插到**最上面**（CHANGELOG 惯例是新版本在最前），
不是追加到末尾。

## 发布媒体校验

开源发布要求：**每版 GitHub / GitLab Release 正文公开时即须包含本版图片或可播放视频**。
`media` 子命令只做校验与提醒，不生成媒体：

```bash
node "$TOOL" media --version 0.28.0
```

会列出找到的媒体、标出哪些是本版、给出可直接粘贴的 Markdown 片段；
找不到本版媒体时退出码非 0 —— 发版前必须补上，否则会产生「无图窗口」。

## 自检清单

- [ ] 标题是 `v<版本> — <核心价值>`，不是裸版本号？
- [ ] 正文纯中文，没有 `feat:` / `fix:` / `chore:` 前缀残留？
- [ ] 五段齐全，空段落有说明？
- [ ] 过程性提交（test/ci/chore/docs/release）都没进正文？
- [ ] 同一主题的多条提交标题都在，没被覆盖？
- [ ] 破坏性变更给了 Before→After 与迁移动作？含 `BREAKING CHANGE:` footer 的提交都识别到了？
- [ ] 「本版要点」里的条目**确实来自版本说明提交**，不是普通提交的内部实现说明？
- [ ] 依赖升级（deps/build）没被误排除？
- [ ] 安装命令能直接复制执行，且无 `<repo>` 这类字面占位符？
- [ ] 版本号与 `--to` 的 tag 一致？（真源是 `--to` tag，不是 `package.json`）
- [ ] 摘要说的是**用户能感知的变化**，不是提交标题的复述？
- [ ] 有本版图片或视频？发版前跑过 `media` 校验？

## 边界

- 不负责决定版本号（SemVer 方向看 `release-notes` skill）。
- 不负责发版动作：`gh release create` / `glab release create` 由执行者按平台自行决定，且发布属于对外动作，需单独授权。
- 不做性能数字的编造：没有证据就不写「快 60%」。
- `--include-internal` 会让正文变长，默认不要用——读者不需要知道内部整理。

## 配套

- `scripts/release-notes.mjs` —— 工具本体，零第三方依赖（只用 Node 内置模块 + git CLI）。
- `scripts/test-release-notes.mjs` —— 自测（115 项断言，临时 git 仓库做 fixture，零网络），CI 会跑。

两者都在仓库的 `scripts/` 目录；`install.sh` 会把该目录软链到各 Agent 的 skills 目录
（`writing-standard-skills-scripts`），所以 skill 装到任何机器后脚本都能直接跑。

## 与 release-notes skill 的分工

- `release-notes`（判据）：什么该写、五段结构、SemVer 方向、体裁边界。
- 本工具（执行）：把提交历史跑成正文。

先按 `release-notes` 的判据确认内容，再用本工具产出，最后按 `release-notes` 的自检清单复核。
