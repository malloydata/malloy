#! /bin/bash
#
# Load the malloytest tables into a running postgres from
# test/data/malloytest-parquet. Connects with the PG* variables.
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)
ROOTDIR=$(cd "$SCRIPTDIR/../.."; pwd)

cd "$ROOTDIR"
npx ts-node test/postgres/load_test_data.ts
