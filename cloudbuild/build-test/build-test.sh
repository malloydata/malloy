#!/usr/bin/env sh
set -euxo pipefail


nix-shell --pure --command "$(cat <<NIXCMD
  export PGHOST=127.0.0.1
  export PGDATABASE=postgres
  export PGUSER=673673622326@cloudbuild.gserviceaccount.com
  cd /workspace
  yarn install
  yarn build
  yarn test
NIXCMD
)"
