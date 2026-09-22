#!/bin/bash
#
# Start a SQL Server container and load the malloytest tables into it from
# test/data/malloytest-parquet.
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)
CONTAINER_NAME="mssql-malloy"
# The loader and the tests read MSSQL_*; this script is the only place a
# default is written. Export the same values to run the tests by hand.
export MSSQL_HOST="${MSSQL_HOST:-localhost}"
export MSSQL_PORT="${MSSQL_PORT:-1433}"
export MSSQL_TRUST_SERVER_CERTIFICATE="${MSSQL_TRUST_SERVER_CERTIFICATE:-true}"
export MSSQL_USER="${MSSQL_USER:-sa}"
export MSSQL_PASSWORD="${MSSQL_PASSWORD:-Malloy_Test_123}"
export MSSQL_DATABASE="${MSSQL_DATABASE:-malloytest}"
SA_PASSWORD="$MSSQL_PASSWORD"

# Check for existing container
if docker container inspect "$CONTAINER_NAME" > /dev/null 2>&1; then
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" = "true" ]; then
    echo "$CONTAINER_NAME is already running"
    exit 0
  fi
  echo "Restarting existing $CONTAINER_NAME container..."
  docker start "$CONTAINER_NAME"
  # The loader waits for the server; reloading is cheap
  sh "$SCRIPTDIR/load_test_data.sh"
  echo "MSSQL running on port $MSSQL_PORT"
  exit 0
fi

# SQL Server 2022 everywhere. Azure SQL Edge has an ARM64 build but a
# 2019-era engine (no JSON_OBJECT, GENERATE_SERIES, DATETRUNC), which the
# sqlserver dialect needs; the x64 image runs under emulation on ARM64 Macs.
IMAGE="mcr.microsoft.com/mssql/server:2022-latest"

echo "Starting $CONTAINER_NAME ($IMAGE)..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=$SA_PASSWORD" \
  -p "$MSSQL_PORT:1433" \
  "$IMAGE"

# The loader waits for the server. A container without its tables must not
# survive to be "already running".
trap 'docker rm -f "$CONTAINER_NAME" > /dev/null; echo "MSSQL setup failed"' ERR
echo "Loading test data..."
sh "$SCRIPTDIR/load_test_data.sh"
trap - ERR

echo "MSSQL running on port $MSSQL_PORT, database: $MSSQL_DATABASE"
echo "Tests need the same MSSQL_HOST/MSSQL_PORT/MSSQL_USER/MSSQL_PASSWORD/MSSQL_DATABASE in their environment"
