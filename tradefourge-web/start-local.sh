#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Locate Node.js across standard macOS paths, nvm, or bundled Antigravity runtime
NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -x "/opt/homebrew/bin/node" ]; then
  NODE_BIN="/opt/homebrew/bin/node"
elif [ -x "/usr/local/bin/node" ]; then
  NODE_BIN="/usr/local/bin/node"
elif [ -x "$HOME/Library/Application Support/Antigravity/bin/agy-node" ]; then
  NODE_BIN="$HOME/Library/Application Support/Antigravity/bin/agy-node"
fi

if [ -z "$NODE_BIN" ]; then
  echo "Error: Could not find a Node.js runtime on this Mac."
  echo "Install Node.js LTS from https://nodejs.org/ and try again."
  exit 1
fi

# Optionally create .env.local from template if missing (never overwrites existing .env.local)
if [ ! -f "$SCRIPT_DIR/.env.local" ] && [ -f "$SCRIPT_DIR/.env.example" ]; then
  cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env.local"
  echo "Created .env.local from .env.example (edit it to add your Google OAuth keys)."
fi

exec "$NODE_BIN" "$SCRIPT_DIR/scripts/dev-server.js"
