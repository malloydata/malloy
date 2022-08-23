#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --command "$(cat <<NIXCMD
  cd /workspace
  npm ci --quiet
  bundle install
  npm run docs-build
NIXCMD
)"
