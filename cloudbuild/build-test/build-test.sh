#!/usr/bin/env sh
set -euxo pipefail


nix-shell --pure --command "$(cat <<NIXCMD
  export PGHOST=127.0.0.1
  cd /workspace
  yarn install
  yarn build
  yarn test
NIXCMD
)"
