#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --keep VSCE_PAT --keep GA_API_SECRET --keep GA_MEASUREMENT_ID --command  "$(cat <<NIXCMD
  cd /workspace
  npm ci --loglevel error
  npm run build && npm run vscode-publish-extensions pre-release
NIXCMD
)"