#!/usr/bin/env sh
set -euxo pipefail

nix-shell \
  --quiet \
  --pure \
  --keep PGHOST \
  --keep PGDATABASE \
  --keep PGUSER \
  --keep SNOWFLAKE_ACCOUNT \
  --keep SNOWFLAKE_USER \
  --keep SNOWFLAKE_PASSWORD \
  --keep SNOWFLAKE_WAREHOUSE \
  --keep SNOWFLAKE_DATABASE \
  --keep SNOWFLAKE_SCHEMA \
  --command "$(cat <<NIXCMD
  set -euxo pipefail
  npm ci --loglevel error
  npm run lint && npm run build && npm run build-duckdb-db && npm run test-silent
NIXCMD
)"
