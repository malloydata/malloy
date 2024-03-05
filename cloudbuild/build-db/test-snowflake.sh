#!/usr/bin/env sh
set -euxo pipefail

nix-shell \
  --quiet \
  --pure \
  --keep SNOWFLAKE_ACCOUNT \
  --keep SNOWFLAKE_USER \
  --keep SNOWFLAKE_PASSWORD \
  --keep SNOWFLAKE_WAREHOUSE \
  --keep SNOWFLAKE_DATABASE \
  --keep SNOWFLAKE_SCHEMA \
  --command "$(cat <<NIXCMD
  set -euxo pipefail
  npm ci --loglevel error
  npm run build
  MALLOY_DATABASES=snowflake npm run test-silent
NIXCMD
)"
