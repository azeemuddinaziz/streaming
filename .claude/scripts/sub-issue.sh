#!/usr/bin/env bash
# Attach GitHub issues as native sub-issues of a parent, or list a parent's sub-issues.
#
#   .claude/scripts/sub-issue.sh <parent> <child> [<child>...]   attach each child
#   .claude/scripts/sub-issue.sh --move <parent> <child>...      also take a child from another parent
#   .claude/scripts/sub-issue.sh --list <parent>                 list the parent's sub-issues
#
# Issue numbers are the #numbers. Safe to re-run: a child already under the parent is skipped.
# A child under a different parent is refused unless --move is given.
set -euo pipefail

usage() { sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
move=false

case "${1:-}" in
  -h|--help) usage ;;
  --list)
    [[ $# -eq 2 ]] || usage 1
    gh api "repos/$repo/issues/$2/sub_issues" --paginate \
      --jq '.[] | "#\(.number)\t\(.state)\t\(.title)"'
    exit 0
    ;;
  --move) move=true; shift ;;
esac

[[ $# -ge 2 ]] || usage 1
parent=$1; shift

for child in "$@"; do
  if [[ "$child" == "$parent" ]]; then
    echo "#$child: cannot be its own sub-issue" >&2; exit 1
  fi

  # 404 means no parent; gh prints the error body to stdout then, so trust only success.
  if ! current=$(gh api "repos/$repo/issues/$child/parent" --jq .number 2>/dev/null); then
    current=""
  fi
  if [[ "$current" == "$parent" ]]; then
    echo "#$child: already a sub-issue of #$parent"
    continue
  fi
  if [[ -n "$current" && "$move" != true ]]; then
    echo "#$child: already a sub-issue of #$current (use --move to re-parent)" >&2; exit 1
  fi

  # The endpoint takes the child's database id, not its #number.
  child_id=$(gh api "repos/$repo/issues/$child" --jq .id)
  args=(-F "sub_issue_id=$child_id")
  [[ -n "$current" ]] && args+=(-F replace_parent=true)
  gh api --method POST "repos/$repo/issues/$parent/sub_issues" "${args[@]}" --silent
  echo "#$child: attached to #$parent"
done
