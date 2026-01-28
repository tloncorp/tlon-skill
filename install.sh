#!/usr/bin/env bash
set -euo pipefail

# Install tlon-skill to the moltbot skills directory
# Run this in the container/pod during image build or as an init script

DEST_DIR="${TLON_SKILL_DIR:-/usr/local/share/moltbot/skills/tlon}"
BIN_DIR="/usr/local/bin"

echo "Installing tlon-skill to $DEST_DIR..."

# Create destination
mkdir -p "$DEST_DIR"

# Copy skill files
cp -r scripts "$DEST_DIR/"
cp -r bin "$DEST_DIR/"
cp SKILL.md "$DEST_DIR/"
cp package.json "$DEST_DIR/"
cp package-lock.json "$DEST_DIR/"
cp tsconfig.json "$DEST_DIR/"

# Install npm dependencies
echo "Installing npm dependencies..."
cd "$DEST_DIR"
npm ci --production=false

# Symlink tlon-run to PATH
echo "Creating symlink: $BIN_DIR/tlon-run -> $DEST_DIR/bin/tlon-run"
ln -sf "$DEST_DIR/bin/tlon-run" "$BIN_DIR/tlon-run"

# Verify installation
if command -v tlon-run &>/dev/null; then
  echo "tlon-run installed successfully"
  tlon-run help
else
  echo "Warning: tlon-run not in PATH"
fi

echo "Done."
