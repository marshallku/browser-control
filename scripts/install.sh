#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Registering MCP server with Claude Code..."
claude mcp add browser-control -- node "$(pwd)/dist/server/index.js"

echo ""
echo "Done! Browser Control MCP server registered."
echo ""
echo "Next steps:"
echo "  1. Load the extension from src/extension/ in your browser"
echo "     - Firefox: about:addons -> Install Add-on From File (or about:debugging for temporary)"
echo "     - Chrome: chrome://extensions -> Developer mode -> Load unpacked"
echo "  2. Restart Claude Code to pick up the new MCP server"
