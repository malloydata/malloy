#!/usr/bin/env sh
set -euxo pipefail


nix-shell --pure --command "$(cat <<NIXCMD
  pwd
  ls
  yarn install
  yarn build
  yarn test
NIXCMD
)"
