#! /bin/bash
#
# Load the malloytest tables into the DuckDB test database
# (test/data/duckdb/duckdb_test.db).
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)
ROOTDIR=$(cd "$SCRIPTDIR/../.."; pwd)

# The payload resolves ./test/data/... relative to the repo root.
cd "$ROOTDIR"
npx ts-node test/duckdb/load_test_data.ts
