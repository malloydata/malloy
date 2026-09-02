#! /bin/bash
#
# Load the malloytest tables into a running mysql from
# test/data/malloytest-parquet. Connects with the MYSQL_* variables.
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)
ROOTDIR=$(cd "$SCRIPTDIR/../.."; pwd)

cd "$ROOTDIR"
npx ts-node test/mysql/load_test_data.ts
