#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --command "$(cat <<NIXCMD
  cd /workspace
  yarn install --frozen-lockfile
  yarn build
  yarn package-extension
NIXCMD
)"
