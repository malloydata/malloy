#!/usr/bin/env sh
set -euxo pipefail


nix-shell --pure --command "$(cat <<NIXCMD
  cd /workspace
  pwd
  ls
  yarn install
  yarn build
  yarn test
NIXCMD
)"
