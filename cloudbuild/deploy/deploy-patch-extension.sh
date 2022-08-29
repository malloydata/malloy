#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --keep VSCE_PAT GA_API_SECRET GA_MEASUREMENT_ID --command  "$(cat <<NIXCMD
  cd /workspace
  npm ci
  npm run build && npm run vscode-publish-extensions patch
NIXCMD
)"