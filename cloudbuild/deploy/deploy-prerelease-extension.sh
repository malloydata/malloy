#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --keep VSCE_PAT --command  "$(cat <<NIXCMD
  cd /workspace
  npm ci
  npm run build && npm run vscode-publish-extensions pre-release
NIXCMD
)"