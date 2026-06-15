#!/usr/bin/env bash
#
# Set up a fresh checkout or `git worktree` for development:
#   1. install dependencies
#   2. build all workspace packages (so jest can resolve @malloydata/* and
#      generated code exists)
#   3. create the gitignored DuckDB test-fixture database
#      (test/data/duckdb/duckdb_test.db) the duckdb test suites need
#
# A new git worktree shares .git but NOT node_modules or gitignored fixtures,
# so run this once after `git worktree add` (or after a fresh clone).
#
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [1/3] npm install"
npm install

echo "==> [2/3] npm run build"
npm run build

echo "==> [3/3] npm run build-duckdb-db"
npm run build-duckdb-db

echo "==> setup complete"
