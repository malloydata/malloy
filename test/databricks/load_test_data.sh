#! /bin/bash
#
# Load the malloytest tables into Databricks.
#
# Requires these env vars to be set:
#   DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID, DATABRICKS_CATALOG
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)
ROOTDIR=$(cd "$SCRIPTDIR/../.."; pwd)

if [ -z "$DATABRICKS_HOST" ]; then
  echo "DATABRICKS_HOST is not set." >&2
  echo "Set DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID, and DATABRICKS_CATALOG first." >&2
  exit 1
fi

cd "$ROOTDIR"
npx tsx test/databricks/load_test_data.ts
