#!/usr/bin/env sh
set -euxo pipefail

nix-shell \
  --quiet \
  --pure \
  --keep PGHOST \
  --keep PGDATABASE \
  --keep PGUSER \
  --command "$(cat <<NIXCMD
  set -euxo pipefail
  npm ci --loglevel error
  export MALLOY_DATABASES=postgres,bigquery,duckdb,duckdb_wasm
  npm run lint
  npm run build
  npm run build-duckdb-db
  npm run test-silent
NIXCMD
)"
