#! /bin/bash
#
# Load the malloytest tables into a running SQL Server from
# test/data/malloytest-parquet. Waits for the server itself.
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)
ROOTDIR=$(cd "$SCRIPTDIR/../.."; pwd)

cd "$ROOTDIR"
npx ts-node test/mssql/load_test_data.ts
