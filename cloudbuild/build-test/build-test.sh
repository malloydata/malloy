#!/usr/bin/env sh
set -euxo pipefail


nix-shell --pure --command "$(cat <<NIXCMD
  while [ ! -f /package.json ]; do sleep 1; done
  yarn install
  yarn build
  yarn test
NIXCMD
)"
