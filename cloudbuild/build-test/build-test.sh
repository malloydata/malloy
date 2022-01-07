#!/usr/bin/env sh
set -euxo pipefail


nix-shell --pure --command "$(cat <<NIXCMD
  useradd postgres
  sudo -u postgres which psql
  cd /workspace
  yarn install
  yarn build
  yarn test
NIXCMD
)"
