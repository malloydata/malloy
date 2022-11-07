#!/usr/bin/env bash
set -euxo pipefail

export PACKAGES="packages/malloy packages/malloy-db-bigquery packages/malloy-db-duckdb packages/malloy-db-postgres packages/malloy-render"

nix-shell --pure --keep NPM_TOKEN --keep PACKAGES --command "$(cat <<NIXCMD
  set -euxo pipefail
  cd /workspace
  npm --no-audit --no-fund ci --loglevel error
  npm run build
  echo Publishing \$PACKAGES
  PRERELEASE=\$(date +%y%m%d%H%M%S)
  for package in \$PACKAGES; do
    VERSION=\$(jq -r .version \$package/package.json)
    echo Publishing \$package \$VERSION-\$PRERELEASE
    npm version -w \$package \$VERSION-\$PRERELEASE
    npm publish -w \$package --dry-run --tag next
  done
NIXCMD
)"
