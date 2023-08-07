#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --command "$(cat <<NIXCMD
  set -euxo pipefail
  export PGHOST=127.0.0.1
  export PGDATABASE=postgres
  export PGUSER=673673622326@cloudbuild
  cd /workspace
  npm ci --silent
  npm run lint && npm run build && npm run build-duckdb-db && npm run test
NIXCMD
)"
