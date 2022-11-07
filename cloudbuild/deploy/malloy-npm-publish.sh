#!/usr/bin/env bash
set -euxo pipefail

PACKAGES="\
packages/malloy \
packages/malloy-db-bq \
packages/malloy-db-duckdb \
packages/malloy-db-postgress \
packages/malloy-render"

nix-shell --pure --keep NPM_TOKEN --keep PACKAGES --command "$(cat <<NIXCMD
  cd /workspace
  npm ci --loglevel error
  npm run build
  for package in $PACKAGES; do
    npm publish -w $package --dry-run
  done
NIXCMD
)"
