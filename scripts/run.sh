#!/bin/bash
# Helper script to run Tlon skill scripts with proper environment
# Reads Urbit config from Clawdbot's gateway config

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# Try to extract config from clawdbot gateway config (JSON)
CONFIG_FILE="${HOME}/.clawdbot/clawdbot.json"
if [ -f "$CONFIG_FILE" ]; then
  if command -v jq &> /dev/null; then
    export URBIT_URL=$(jq -r '.channels.tlon.url // empty' "$CONFIG_FILE")
    export URBIT_SHIP=$(jq -r '.channels.tlon.ship // empty' "$CONFIG_FILE")
    export URBIT_CODE=$(jq -r '.channels.tlon.code // empty' "$CONFIG_FILE")
  fi
fi

# Check if we have config
if [ -z "$URBIT_URL" ] || [ -z "$URBIT_SHIP" ] || [ -z "$URBIT_CODE" ]; then
  echo "Warning: Could not load Urbit config from $CONFIG_FILE"
  echo "Set URBIT_URL, URBIT_SHIP, and URBIT_CODE environment variables manually"
fi

# Ensure dependencies are installed
if [ ! -d "$SKILL_DIR/node_modules" ]; then
  echo "Installing dependencies..."
  (cd "$SKILL_DIR" && npm install)
fi

# Run the requested script
SCRIPT_NAME="$1"
shift

if [ -z "$SCRIPT_NAME" ]; then
  echo "Usage: run.sh <script> [args...]"
  echo "Scripts: contacts, channels"
  exit 1
fi

cd "$SKILL_DIR"
npx ts-node "scripts/${SCRIPT_NAME}.ts" "$@"
