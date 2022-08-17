#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --keep VSCE_PAT GA_API_SECRET GA_MEASUREMENT_ID --command  "$(cat <<NIXCMD
  cd /workspace
  yarn install --frozen-lockfile
  yarn build && yarn vscode-publish-extensions pre-release
NIXCMD
)"