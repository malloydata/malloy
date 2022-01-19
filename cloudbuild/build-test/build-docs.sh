#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --command "$(cat <<NIXCMD
  cd /workspace
  yarn install
  bundle install
  yarn docs-build
NIXCMD
)"
