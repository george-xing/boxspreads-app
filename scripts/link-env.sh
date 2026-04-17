#!/usr/bin/env bash
# Link this worktree's .env.local to the durable, worktree-proof location at ~/.boxspreads/.env.local.
#
# Why: worktrees and even the main checkout get nuked (git clean -fdx, worktree remove, fresh clone).
# Storing real secrets inside the repo means we lose them every time. ~/.boxspreads sits outside any
# git directory, has 700 perms, and survives every operation we routinely do.
#
# Usage:
#   ./scripts/link-env.sh        # creates symlink in cwd
#
# Run once per fresh worktree. Idempotent.

set -euo pipefail

DURABLE_DIR="$HOME/.boxspreads"
DURABLE_FILE="$DURABLE_DIR/.env.local"
TARGET=".env.local"

if [[ ! -f "$DURABLE_FILE" ]]; then
  echo "error: $DURABLE_FILE does not exist." >&2
  echo "Bootstrap it first:" >&2
  echo "  mkdir -p $DURABLE_DIR && chmod 700 $DURABLE_DIR" >&2
  echo "  cp .env.local.example $DURABLE_FILE && chmod 600 $DURABLE_FILE" >&2
  echo "  # then fill in real values" >&2
  exit 1
fi

if [[ -e "$TARGET" && ! -L "$TARGET" ]]; then
  echo "error: $TARGET exists and is a regular file, not a symlink." >&2
  echo "Move/delete it first, then re-run:" >&2
  echo "  mv $TARGET ${TARGET}.bak && ./scripts/link-env.sh" >&2
  exit 1
fi

ln -sf "$DURABLE_FILE" "$TARGET"
echo "linked: $TARGET -> $DURABLE_FILE"
ls -la "$TARGET"
