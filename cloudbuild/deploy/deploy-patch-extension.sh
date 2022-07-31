#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --keep VSCE_PAT --command  "$(cat <<NIXCMD
  cd /workspace
  yarn install --frozen-lockfile
  yarn build && yarn vscode-publish-extensions patch
NIXCMD
)"