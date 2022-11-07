#!/usr/bin/env bash
set -euxo pipefail

export PACKAGES="packages/malloy packages/malloy-db-bigquery packages/malloy-db-duckdb packages/malloy-db-postgres packages/malloy-render"

nix-shell --pure --keep BRANCH_NAME --keep NPM_TOKEN --keep PACKAGES --run "$(cat <<NIXCMD
  set -euxo pipefail
  cd /workspace
  git checkout \$BRANCH_NAME
  npm --no-audit --no-fund ci --loglevel error
  npm run build
  echo Publishing \$PACKAGES
  for package in \$PACKAGES; do
    echo Publishing \$package
    VERSION=\$(jq -r .version \$package/package.json)
    PRERELEASE=\$(git rev-list --count \$BRANCH_NAME)
    npm version -w \$package \$VERSION-\$PRERELEASE
    npm publish -w \$package --dry-run --tag next
  done
NIXCMD
)"
