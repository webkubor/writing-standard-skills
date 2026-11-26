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
# 与 CortexOS 的 registry/skill-runtimes.json 对齐：九个运行时全覆盖。
# 此前只装四处，导致 CS 里 cursor/opencode/dsh/hermes 缺 skill —— 本仓是技能真源，
# 必须保证「装一次，所有 Agent 都有」，不能靠每个 Agent 各自补。
TARGET_AGENTS=(
  "${HOME}/.agents/skills|全局标准中心 (~/.agents/skills)"
  "${HOME}/.claude/skills|Claude Code (~/.claude/skills)"
  "${HOME}/.codex/skills|OpenAI Codex (~/.codex/skills)"
  "${HOME}/.cursor/skills|Cursor (~/.cursor/skills)"
  "${HOME}/.config/opencode/skills|OpenCode (~/.config/opencode/skills)"
  "${HOME}/.gemini/config/skills|本地 GUI / Antigravity (~/.gemini/config/skills)"
  "${HOME}/.dsh/skills|DSH (~/.dsh/skills)"
  "${HOME}/.config/magpie/library/skills|Magpie (~/.config/magpie/library/skills)"
  "${HOME}/.hermes/skills|Hermes (~/.hermes/skills)"
)

# Hermes 每个 profile 就是一个独立 Agent，技能必须跟着走
for profile_dir in "${HOME}"/.hermes/profiles/*; do
  if [ -d "${profile_dir}" ]; then
    TARGET_AGENTS+=("${profile_dir}/skills|Hermes profile ($(basename "${profile_dir}"))")
  fi
done

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
# 内核的理论后盾，按需查阅，不常驻
if [ -f "${SCRIPT_DIR}/identity/dialogue-foundations.md" ]; then
  ln -sfn "${SCRIPT_DIR}/identity/dialogue-foundations.md" "${HOME}/.agents/skills/writing-standard-skills-dialogue-foundations.md"
  echo -e "${GREEN}   ✅ 对话底层框架已挂载至 ~/.agents/skills/writing-standard-skills-dialogue-foundations.md${NC}"
fi

# 5. 常驻身份内核：写进各 Agent 的常驻配置文件（标记块幂等替换）
# 技能是按需加载的，但「说中文 / 说人话 / 持续推进 / 脾气」必须每轮在场。
# 单一真源在 identity/kernel.md；这里只做标记块替换，块外内容一概不动。
KERNEL_SOURCE="${SCRIPT_DIR}/identity/kernel.md"
KERNEL_BEGIN='<!-- wss-kernel:begin -->'
KERNEL_END='<!-- wss-kernel:end -->'

upsert_kernel() {
  local target="$1" label="$2"
  if [ ! -f "${KERNEL_SOURCE}" ]; then
    echo "   ⚠️ 未找到 ${KERNEL_SOURCE}，跳过 ${label}" >&2
    return 0
  fi
  mkdir -p "$(dirname "${target}")"
  if [ ! -f "${target}" ]; then
    : > "${target}"
  fi

  local has_block=0
  if grep -qF "${KERNEL_BEGIN}" "${target}" && grep -qF "${KERNEL_END}" "${target}"; then
    has_block=1
  fi

  if [ "${has_block}" -eq 0 ] && [ ! -f "${target}.bak-wss-kernel" ]; then
    cp "${target}" "${target}.bak-wss-kernel"
  fi

  local tmp
  tmp="$(mktemp)"
  if [ "${has_block}" -eq 1 ]; then
    awk -v begin="${KERNEL_BEGIN}" -v end="${KERNEL_END}" -v kernel="${KERNEL_SOURCE}" '
      $0 == begin { print; while ((getline line < kernel) > 0) print line; close(kernel); skipping=1; next }
      $0 == end { print; skipping=0; next }
      !skipping { print }
    ' "${target}" > "${tmp}"
  else
    {
      printf '%s\n' "${KERNEL_BEGIN}"
      cat "${KERNEL_SOURCE}"
      printf '%s\n' "${KERNEL_END}"
      printf '\n'
      cat "${target}"
    } > "${tmp}"
  fi
  cp "${tmp}" "${target}"
  rm -f "${tmp}"
  echo -e "${GREEN}   ✅ 常驻身份内核已写入 ${label}${NC}"
}

echo -e "\n${BLUE}🧠 写入常驻身份内核（单一真源 identity/kernel.md）...${NC}"
upsert_kernel "${HOME}/.claude/CLAUDE.md" "Claude Code (~/.claude/CLAUDE.md)"
upsert_kernel "${HOME}/.codex/AGENTS.md" "Codex (~/.codex/AGENTS.md)"
upsert_kernel "${HOME}/.hermes/SOUL.md" "Hermes (~/.hermes/SOUL.md)"
upsert_kernel "${HOME}/.config/opencode/AGENTS.md" "OpenCode (~/.config/opencode/AGENTS.md)"

# 5.1 版本自检提示：装完就告诉用户本地版本是否和清单一致、是否落后远端
if [ -f "${SCRIPT_DIR}/scripts/check-version.mjs" ] && command -v node >/dev/null 2>&1; then
  node "${SCRIPT_DIR}/scripts/check-version.mjs" || true
fi

echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 writing-standard-skills (v${PACKAGE_VERSION}) 已全量接入本机 Agent 矩阵与本地 GUI！${NC}"
echo -e "   • 包含平台: DSH / Claude Code / Codex / Antigravity GUI"
echo -e "   • 模式: 软链接直连 (本地源码修改后所有 Agent 即时生效，无需重装)"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
