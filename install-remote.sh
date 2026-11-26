#!/usr/bin/env bash
# ==============================================================================
# 远程 Agent 安装器 —— 只从开源仓 URL 拉取，不认本地相对路径
#
# 为什么单独有一个远程安装器
#   服务器/X主机上本来就没有这份源码，任何「指向本机某个目录」的软链都是空的。
#   远程安装必须先 git clone https://github.com/... 到一个绝对缓存目录，
#   再在缓存里跑 install.sh。清单真源是 skills-manifest.json。
#
# 用法（服务器上一行）：
#   curl -fsSL https://raw.githubusercontent.com/webkubor/writing-standard-skills/main/install-remote.sh | bash
#
# 自定义：
#   WRITING_STANDARD_SKILLS_REPO=<fork-url>  换仓
#   WRITING_STANDARD_SKILLS_REF=<branch|tag> 换版本
#   WRITING_STANDARD_SKILLS_HOME=<abs-path>  换缓存目录
# ==============================================================================

set -euo pipefail

REPO="${WRITING_STANDARD_SKILLS_REPO:-https://github.com/webkubor/writing-standard-skills.git}"
REF="${WRITING_STANDARD_SKILLS_REF:-main}"
CACHE="${WRITING_STANDARD_SKILLS_HOME:-${HOME}/.local/share/writing-standard-skills}"

# 必须是绝对路径：远程场景下「相对路径」没有意义。
case "${CACHE}" in
  /*) ;;
  *) echo "❌ WRITING_STANDARD_SKILLS_HOME 必须是绝对路径：${CACHE}" >&2; exit 1 ;;
esac

if ! command -v git >/dev/null 2>&1; then
  echo "❌ 找不到 git，无法从开源仓拉取技能。" >&2
  exit 1
fi

echo "📥 从开源仓拉取：${REPO} (${REF}) → ${CACHE}"

if [ -d "${CACHE}/.git" ]; then
  # 已缓存：只做快进，不覆盖缓存里的本地改动（快进失败就报错让人处理）
  git -C "${CACHE}" fetch --depth 1 origin "${REF}"
  git -C "${CACHE}" merge --ff-only FETCH_HEAD
  echo "   ✅ 已缓存并快进到最新"
else
  if [ -e "${CACHE}" ]; then
    echo "❌ 缓存路径已存在但不是 git 仓：${CACHE}" >&2
    exit 1
  fi
  mkdir -p "$(dirname "${CACHE}")"
  git clone --depth 1 --branch "${REF}" "${REPO}" "${CACHE}"
  echo "   ✅ 首次拉取完成"
fi

# 清单校验：确认拉到的是这个仓，且 skill 数量对得上
MANIFEST="${CACHE}/skills-manifest.json"
if [ ! -f "${MANIFEST}" ]; then
  echo "❌ 拉下的仓缺少 skills-manifest.json，可能不是目标仓或版本过旧：${CACHE}" >&2
  exit 1
fi
node -e '
const fs = require("fs");
const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const dir = process.argv[2];
const missing = m.skills.filter(s => !fs.existsSync(`${dir}/skills/${s}/SKILL.md`));
if (missing.length) { console.error("❌ 清单里的 skill 缺失: " + missing.join(", ")); process.exit(1); }
console.log(`   ✅ 清单校验通过：${m.skills.length} 个 skill 齐全`);
' "${MANIFEST}" "${CACHE}"

# 缓存里的 install.sh 会自己装到全部运行时、写常驻内核；源码路径全部来自缓存绝对路径。
echo "🚀 安装到本机各 Agent 运行时..."
exec bash "${CACHE}/install.sh"
