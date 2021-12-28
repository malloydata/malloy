#!/usr/bin/env sh
set -euxo pipefail


nix-shell --pure --command "$(cat <<NIXCMD
  cat /etc/passwds
  export PGHOST=localhost
  cd postgres_test
  bash postgres_init.sh
  cd ..
  yarn install
  yarn build
  yarn test
NIXCMD
)"
