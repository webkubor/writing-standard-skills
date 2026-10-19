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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_SKILLS_DIR="${SCRIPT_DIR}/skills"

# 终端彩色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🚀 开始初始化 writing-standard-skills 接入各大 Agent 运行时与本地 GUI...${NC}"

# 1. 待分发的 Skills 清单
SKILLS=(
  "how-to-write"
  "platform-voices"
  "scenario-openers"
  "peer-facing-writing"
  "talk-text-review"
  "talk-visual-review"
)

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
done

# 4. 同步原子矩阵速查文件至 ~/.agents/
if [ -f "${SOURCE_SKILLS_DIR}/atomic-matrix.md" ]; then
  ln -sfn "${SOURCE_SKILLS_DIR}/atomic-matrix.md" "${HOME}/.agents/skills/writing-standard-skills-atomic-matrix.md"
  echo -e "${GREEN}   ✅ 5D 原子表达组合矩阵已挂载至 ~/.agents/skills/writing-standard-skills-atomic-matrix.md${NC}"
fi

echo -e "\n${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 writing-standard-skills (v2.0.0) 已全量接入本机 Agent 矩阵与本地 GUI！${NC}"
echo -e "   • 包含平台: DSH / Claude Code / Codex / Antigravity GUI"
echo -e "   • 模式: 软链接直连 (本地源码修改后所有 Agent 即时生效，无需重装)"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
