#! /bin/bash
#
# Load the malloytest tables into Athena from test/data/malloytest-parquet.
# Needs the ATHENA_* variables the athena test runtime reads, plus
# ATHENA_TEST_DATA_LOCATION (s3://bucket/prefix/); credentials come from the
# AWS default chain.
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)
ROOTDIR=$(cd "$SCRIPTDIR/../.."; pwd)

cd "$ROOTDIR"
npx ts-node test/athena/load_test_data.ts
