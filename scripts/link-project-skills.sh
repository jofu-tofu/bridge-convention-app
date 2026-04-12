#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_SKILLS_DIR="$ROOT_DIR/skills"

if [[ ! -d "$PROJECT_SKILLS_DIR" ]]; then
  exit 0
fi

link_skill() {
  local skill_dir="$1"
  local target_root="$2"
  local skill_name
  local target

  skill_name="$(basename "$skill_dir")"
  target="$target_root/skills/$skill_name"

  mkdir -p "$target_root/skills"

  if [[ -L "$target" ]] && [[ "$(readlink -f "$target")" == "$skill_dir" ]]; then
    return
  fi

  rm -rf "$target"
  ln -s "$skill_dir" "$target"
}

for tool_root in "$ROOT_DIR/.claude" "$ROOT_DIR/.codex" "$ROOT_DIR/.devin"; do
  for skill_dir in "$PROJECT_SKILLS_DIR"/*; do
    [[ -d "$skill_dir" ]] || continue
    [[ -f "$skill_dir/SKILL.md" ]] || continue
    link_skill "$skill_dir" "$tool_root"
  done
done

printf 'Linked project skills into .claude/.codex/.devin\n'
