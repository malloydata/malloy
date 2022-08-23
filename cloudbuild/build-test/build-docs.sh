#!/usr/bin/env sh
set -euxo pipefail

nix-shell --quiet --pure --command "$(cat <<NIXCMD
  cd /workspace
  npm ci --silent
  bundle install
  npm run docs-build
NIXCMD
)"
