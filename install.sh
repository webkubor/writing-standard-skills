#!/usr/bin/env bash
# ==============================================================================
# writing-standard-skills — 全 Agent 一键智能初始化与软链接接入脚本
#
# 支持目标：
#   1. 全局标准中心 : ~/.agents/skills/
#   2. Claude Code  : ~/.claude/skills/
#   3. OpenAI Codex : ~/.codex/skills/
#   4. DSH 系统     : ~/.dsh/ (通过 ~/.agents/skills 统一加载)
#   5. 本地 GUI     : ~/.gemini/config/skills/ (Antigravity IDE / GUI)
# ==============================================================================

set -euo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]:-}"
if [ -n "${SCRIPT_SOURCE}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
else
  SCRIPT_DIR="${PWD}"
fi

# When this file is piped from the remote one-liner, BASH_SOURCE[0] is empty
# and SCRIPT_DIR is the caller's current directory. Bootstrap a persistent
# checkout so the symlinks keep pointing at a real source tree after the
# installer exits.
if [ ! -d "${SCRIPT_DIR}/skills" ]; then
  REPOSITORY_URL="${WRITING_STANDARD_SKILLS_REPOSITORY:-https://github.com/webkubor/writing-standard-skills.git}"
  CACHE_DIR="${WRITING_STANDARD_SKILLS_HOME:-${HOME}/.local/share/writing-standard-skills}"

  if [ -d "${CACHE_DIR}/skills" ]; then
    SCRIPT_DIR="${CACHE_DIR}"
  else
    if ! command -v git >/dev/null 2>&1; then
      echo "❌ 找不到本地 skills/，且 git 不可用，无法完成远程安装。" >&2
      exit 1
    fi
    if [ -e "${CACHE_DIR}" ]; then
      echo "❌ 安装缓存目录已存在但不是 writing-standard-skills 仓库：${CACHE_DIR}" >&2
      exit 1
    fi
    mkdir -p "$(dirname "${CACHE_DIR}")"
    echo "📥 首次远程安装：将源码保存到 ${CACHE_DIR}"
    git clone --depth 1 "${REPOSITORY_URL}" "${CACHE_DIR}"
    SCRIPT_DIR="${CACHE_DIR}"
  fi
fi

SOURCE_SKILLS_DIR="${SCRIPT_DIR}/skills"

PACKAGE_VERSION="unknown"
if [ -f "${SCRIPT_DIR}/package.json" ]; then
  PACKAGE_VERSION="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${SCRIPT_DIR}/package.json" | head -n 1)"
  PACKAGE_VERSION="${PACKAGE_VERSION:-unknown}"
fi

# 终端彩色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🚀 开始初始化 writing-standard-skills 接入各大 Agent 运行时与本地 GUI...${NC}"

# 1. 从源码目录自动发现 Skills，避免新增目录后漏改安装清单。
SKILLS=()
for skill_dir in "${SOURCE_SKILLS_DIR}"/*; do
  if [ -d "${skill_dir}" ] && [ -f "${skill_dir}/SKILL.md" ]; then
    SKILLS+=("${skill_dir##*/}")
  fi
done

if [ "${#SKILLS[@]}" -eq 0 ]; then
  echo "❌ 未找到任何包含 SKILL.md 的技能目录：${SOURCE_SKILLS_DIR}" >&2
  exit 1
fi

# 2. 目标 Agent 目录列表 (目标路径, 标识名)
TARGET_AGENTS=(
  "${HOME}/.agents/skills|全局标准中心 (~/.agents/skills)"
  "${HOME}/.claude/skills|Claude Code (~/.claude/skills)"
  "${HOME}/.codex/skills|OpenAI Codex (~/.codex/skills)"
  "${HOME}/.gemini/config/skills|本地 GUI / Antigravity (~/.gemini/config/skills)"
)

# 确保全局标准目录存在
mkdir -p "${HOME}/.agents/skills"

# 3. 逐个 Agent 分发软链接
for entry in "${TARGET_AGENTS[@]}"; do
  IFS="|" read -r target_dir agent_name <<< "${entry}"

  echo -e "\n${BLUE}📦 检测并配置 ${agent_name}...${NC}"
  mkdir -p "${target_dir}"

  installed_count=0
  for skill in "${SKILLS[@]}"; do
    src_path="${SOURCE_SKILLS_DIR}/${skill}"
    dest_path="${target_dir}/${skill}"

    if [ -d "${src_path}" ]; then
      # 建立绝对路径软链接（幂等覆写）
      ln -sfn "${src_path}" "${dest_path}"
      installed_count=$((installed_count + 1))
    fi
  done
  echo -e "${GREEN}   ✅ 成功接入 ${installed_count} 个 skills 至 ${target_dir}${NC}"

  # 4.1 把仓库的 scripts/ 目录一并链过去 —— 带工具脚本的 skill（如
  # release-notes-tool）需要能定位到 scripts/release-notes.mjs，
  # 而 skill 目录是整目录软链接，脚本在仓库根 scripts/ 时跨目录找不到。
  # 链成 <target_dir>/writing-standard-skills-scripts，
  # SKILL.md 里用相对路径 ../writing-standard-skills-scripts/release-notes.mjs 定位。
  if [ -d "${SCRIPT_DIR}/scripts" ]; then
    ln -sfn "${SCRIPT_DIR}/scripts" "${target_dir}/writing-standard-skills-scripts"
  fi
done

# 4. 同步原子矩阵速查文件至 ~/.agents/
if [ -f "${SOURCE_SKILLS_DIR}/atomic-matrix.md" ]; then
  ln -sfn "${SOURCE_SKILLS_DIR}/atomic-matrix.md" "${HOME}/.agents/skills/writing-standard-skills-atomic-matrix.md"
  echo -e "${GREEN}   ✅ 5D 原子表达组合矩阵已挂载至 ~/.agents/skills/writing-standard-skills-atomic-matrix.md${NC}"
fi

echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 writing-standard-skills (v${PACKAGE_VERSION}) 已全量接入本机 Agent 矩阵与本地 GUI！${NC}"
echo -e "   • 包含平台: DSH / Claude Code / Codex / Antigravity GUI"
echo -e "   • 模式: 软链接直连 (本地源码修改后所有 Agent 即时生效，无需重装)"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
