#!/usr/bin/env sh
set -euxo pipefail

nix-shell --quiet --pure --command "$(cat <<NIXCMD
  set -euxo pipefail # exits if any of the below commands fail
  export PGHOST=127.0.0.1
  export PGDATABASE=postgres
  export PGUSER=673673622326@cloudbuild
  cd /workspace
  npm run check-node-version
  npm ci --silent
  npm run lint && npm run build && npm run build-duckdb-db && npm run test-silent
NIXCMD
)"
