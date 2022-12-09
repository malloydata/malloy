#!/usr/bin/env bash
set -euxo pipefail

export PACKAGES="packages/malloy packages/malloy-db-bigquery packages/malloy-db-duckdb packages/malloy-db-postgres packages/malloy-render"

nix-shell --pure --keep NPM_TOKEN --keep PACKAGES --keep BRANCH_NAME --command "$(cat <<NIXCMD
  set -euxo pipefail
  cd /workspace
  # Change to actual branch
  git branch \$BRANCH_NAME
  git checkout \$BRANCH_NAME
  # Configure git user
  git config --global user.email "malloy-ci-bot@google.com"
  git config --global user.name "Malloy CI Bot"
  # Build
  npm --no-audit --no-fund ci --loglevel error
  npm run build
  # Publish
  echo Publishing \$PACKAGES
  VERSION=\$(jq -r .version ./lerna.json)
  for package in \$PACKAGES; do
    echo Publishing \$package \$VERSION
    npm publish -w \$package --dry-run
  done
  # Tag current version
  git tag v\$VERSION-test
  git push origin v\$VERSION-test
  # Bump version
  npx lerna version patch --yes --no-push --no-git-tag-version
  VERSION=\$(jq -r .version ./lerna.json)
  echo Updating to \$VERSION
  # Push new version to github
  git commit -am "Version \$VERSION-dev"
  git remote set-url origin git@github.com:malloydata/malloy
  git push origin \$BRANCH_NAME
NIXCMD
)"
