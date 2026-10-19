# 与 facet 的边界

writing-standard-skills 和 [facet](https://github.com/webkubor/facet) 是同一条链的两段，**互不越界**：

| | writing-standard-skills | facet |
|---|---|---|
| 管什么 | **说什么、怎么组织、什么语气** | **长什么样** |
| 具体 | 结论先行 / SCQA / MECE / 分组归属 / 读者定位 / 语气姿态 / 讲稿站位 | 字阶、密度、留白、分页、配色、模板、PDF 与长图渲染 |
| 产物 | Markdown 内容 | PDF / 长图 / 可分享站点 |
| 何时用 | 动笔前到定稿前 | 定稿后 |

**协作方式**：用 writing-standard-skills 把内容写对，交给 facet 渲染。

```bash
# 内容定稿后
npx facet --input talk.md --template wechat-magazine --output talk.pdf
```

**不要在 writing-standard-skills 里写排版规范**（字号、留白、分页阈值），那些是 facet 的 `docs/design-spec.md` 管的，重复写必然漂移。反过来，facet 不管内容的逻辑结构和语气——那是本仓的事。

**边界上的一条**：演讲版和阅读版是同一份内容的两个刻面（facet 的站点就这么做的：阅读版连续长文、演讲版一屏一章节）。**刻面切换是 facet 的能力，但两种刻面下内容该怎么组织是 writing-standard-skills 的事**——演讲版要一屏一个论点、阅读版可以层层递进。

## 已核对：两边没有重复定义（2026-09-10）

查过 facet 全仓，涉及「表达」的两个文件都不是方法论，不与本仓冲突：

| facet 里的文件 | 是什么 | 归属 |
|---|---|---|
| `docs/design-spec.md` | 排版规范：字阶、密度策略、留白上限、分页量测、打印约束 | **facet 的核心资产**，本仓不碰 |
| `launch-kit/brief.md` | facet 这一次发布的具体决策：受众、核心承诺、语气取向、CTA、已知约束 | **实例**，不是方法 |

`brief.md` 里的「语气：工具向、克制、以实测截图说话」是一次性决策，writing-standard-skills 提供的是得出这类决策的方法。两者是方法与实例的关系，各自留在原地。

已在 `brief.md` 顶部加了指向本仓的说明，避免 facet 后续写 README / 社交贴 / 视频脚本时又自攒一套写作规则。

**维护约定**：facet 里出现任何「文案该怎么写」的通用规则，都应该搬进本仓；本仓里出现任何字号、留白、分页的数值，都应该搬回 facet。

---

## 生态位：和其他仓库的分工

表达这件事拆成「说什么 / 长什么样 / 怎么念 / 在哪写」四段，各有归属，**互不重复定义**。这张表是分工的真源，其他仓库只留一行指针回来。

| 仓库 | 管这一段 | 与本仓的关系 |
|---|---|---|
| **writing-standard-skills**（本仓） | **说什么、怎么组织、什么语气** | 方法论真源 |
| [facet](https://github.com/webkubor/facet) | **长什么样**：字阶、密度、留白、分页、模板、PDF 与长图渲染 | 定稿后交给它渲染；排版数值一律不写进本仓 |
| [voxflow](https://github.com/webkubor/voxflow) | **怎么念**：声音设计与调教、戏感、防误读协议、对谈缝合 | 口播稿的**文字内容**用本仓，**怎么演绎**用它的 `VOICE_DESIGN_SOP.md` |
| [typora-Bloom-theme](https://github.com/webkubor/typora-Bloom-theme) | **在哪写**：长文写作与专注阅读的编辑器环境 | 写作环境，不涉及方法 |

### 判断归属的一句话

- 出现「**该说什么、先说哪句、这话得罪人吗**」→ writing-standard-skills
- 出现「**字号多大、留多少白、怎么分页**」→ facet
- 出现「**这句怎么念、语气怎么走、哪里停顿**」→ voxflow

### 不收进本仓的表达类内容

- **叙事创作**（剧本、小说、人物设定）：与职场表达是两套东西，见各创作仓自己的 SSOT 清单
- **视觉表达**（IP 设计、表情包、配图）：归各自项目
- **单次发布的具体决策**（这次文案的受众、语气取向、CTA）：属于该项目的 launch-kit，本仓只提供得出这类决策的方法
