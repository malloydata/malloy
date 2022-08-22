#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --command "$(cat <<NIXCMD
  export PGHOST=127.0.0.1
  export PGDATABASE=postgres
  export PGUSER=673673622326@cloudbuild
  cd /workspace
  npm ci
  npm run lint && npm run build && npm run build-duckdb-db && npm run test-silent
NIXCMD
)"
