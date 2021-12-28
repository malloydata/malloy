#!/usr/bin/env sh
set -euxo pipefail


nix-shell --pure --command "$(cat <<NIXCMD
  export PGHOST=localhost
  cd postgres_test
  ./postgres_init.sh
  cd ..
  yarn install
  yarn build
  yarn test
NIXCMD
)"
