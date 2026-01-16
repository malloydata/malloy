#! /bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRESTO_VERSION=0.287
USE_SLIM=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --slim)
      USE_SLIM=true
      shift
      ;;
  esac
done

rm -rf .tmp
mkdir .tmp

# generate config file
> ./.tmp/bigquery-pesto.properties
cat << EOF > ./.tmp/bigquery-pesto.properties
connector.name=bigquery
bigquery.project-id=advance-lacing-417917
bigquery.credentials-key=$BQ_CREDENTIALS_KEY
EOF

# Select image
if [ "$USE_SLIM" = true ]; then
  PRESTO_IMAGE="presto-slim:${PRESTO_VERSION}"
  # Build slim image if it doesn't exist
  if ! docker image inspect "$PRESTO_IMAGE" > /dev/null 2>&1; then
    echo "Building slim Presto image..."
    docker build -f "$SCRIPT_DIR/Dockerfile.slim" \
      --build-arg PRESTO_VERSION="$PRESTO_VERSION" \
      -t "$PRESTO_IMAGE" "$SCRIPT_DIR"
  fi
else
  PRESTO_IMAGE="prestodb/presto:${PRESTO_VERSION}"
fi

# run docker
docker run -p ${PRESTO_PORT:-8080}:8080 -d -v ./.tmp/bigquery-pesto.properties:/opt/presto-server/etc/catalog/bigquery.properties --name presto-malloy "$PRESTO_IMAGE"

# wait for server to start
counter=0
while ! docker logs presto-malloy 2>&1 | grep -q "SERVER STARTED"
do
  sleep 1
  counter=$((counter+1))
  # if doesn't start after 2 minutes, output logs and kill process
  if [ $counter -eq 120 ]
  then
    docker logs presto-malloy >& ./.tmp/presto-malloy.logs
    docker rm -f presto-malloy
    echo "Presto did not start successfully, check .tmp/presto-malloy.logs"
    exit 1
    break
  fi
done

echo "Presto running on port 8080"