#!/bin/bash
#
# Start a SQL Server container and load the malloytest tables into it from
# test/data/malloytest-parquet.
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)
CONTAINER_NAME="mssql-malloy"
# Must match test/mssql/connection_string.ts
SA_PASSWORD="Malloy_Test_123"

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
  echo "MSSQL running on port 1433"
  exit 0
fi

# Detect architecture — Azure SQL Edge for ARM64, SQL Server for x64
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
  IMAGE="mcr.microsoft.com/azure-sql-edge:latest"
else
  IMAGE="mcr.microsoft.com/mssql/server:2022-latest"
fi

echo "Starting $CONTAINER_NAME ($IMAGE)..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=$SA_PASSWORD" \
  -p 1433:1433 \
  "$IMAGE"

# The loader waits for the server. A container without its tables must not
# survive to be "already running".
trap 'docker rm -f "$CONTAINER_NAME" > /dev/null; echo "MSSQL setup failed"' ERR
echo "Loading test data..."
sh "$SCRIPTDIR/load_test_data.sh"
trap - ERR

echo "MSSQL running on port 1433, database: malloytest"
