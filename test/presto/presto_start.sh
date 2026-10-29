#! /bin/bash
#
# Start a presto container whose hive catalog serves test/data/malloytest-parquet
# as the malloytest schema. The parquet is read in place; nothing is loaded.
#
#   presto_start.sh [--slim]   use the slim image from Dockerfile.slim
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)
ROOTDIR=$(cd "$SCRIPTDIR/../.."; pwd)
DATADIR=$ROOTDIR/test/data/malloytest-parquet
PRESTO_VERSION=0.287
USE_SLIM=false
CONTAINER_NAME="presto-malloy"
PORT=${PRESTO_PORT:-8080}

# Parse arguments
for arg in "$@"; do
  case $arg in
    --slim)
      USE_SLIM=true
      shift
      ;;
  esac
done

cd "$ROOTDIR"
rm -rf .tmp
mkdir .tmp

# Select image
if [ "$USE_SLIM" = true ]; then
  PRESTO_IMAGE="presto-slim:${PRESTO_VERSION}"
  # Build slim image if it doesn't exist
  if ! docker image inspect "$PRESTO_IMAGE" > /dev/null 2>&1; then
    echo "Building slim Presto image..."
    docker build -f "$SCRIPTDIR/Dockerfile.slim" \
      --build-arg PRESTO_VERSION="$PRESTO_VERSION" \
      -t "$PRESTO_IMAGE" "$SCRIPTDIR"
  fi
else
  PRESTO_IMAGE="prestodb/presto:${PRESTO_VERSION}"
fi

# Only the log since this script started: a restarted container's old log
# already says SERVER STARTED.
SINCE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

wait_for_presto() {
  local counter=0
  while ! docker logs --since "$SINCE" "$CONTAINER_NAME" 2>&1 | grep -q "SERVER STARTED"; do
    counter=$((counter+1))
    # give up after 2 minutes
    if [ $counter -eq 120 ]; then
      docker logs "$CONTAINER_NAME" >& ./.tmp/presto-malloy.logs
      return 1
    fi
    sleep 1
  done
}

# Check for existing container
if docker container inspect "$CONTAINER_NAME" > /dev/null 2>&1; then
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" = "true" ]; then
    echo "$CONTAINER_NAME is already running"
    exit 0
  fi
  echo "Restarting existing $CONTAINER_NAME container..."
  docker start "$CONTAINER_NAME"
  if ! wait_for_presto; then
    echo "Presto did not restart successfully, check .tmp/presto-malloy.logs"
    exit 1
  fi
  echo "Presto running on port $PORT"
  exit 0
fi

# A hive external_location is a directory, so each parquet file gets one.
MOUNTS=()
for parquet in "$DATADIR"/*.parquet; do
  table=$(basename "$parquet" .parquet)
  MOUNTS+=(-v "$parquet:/data/malloytest/$table/$table.parquet:ro")
done

docker run -p $PORT:8080 -d "${MOUNTS[@]}" \
  -v "$SCRIPTDIR/hive.properties:/opt/presto-server/etc/catalog/hive.properties:ro" \
  --name "$CONTAINER_NAME" "$PRESTO_IMAGE"

# A container without its tables must not survive to be "already running"
trap 'docker rm -f "$CONTAINER_NAME" > /dev/null; echo "Presto setup failed, check .tmp/presto-malloy.logs"' ERR

if ! wait_for_presto; then
  false
fi

echo "Creating the malloytest tables"
npx ts-node test/trino/hive_ddl.ts hive file:///data/malloytest --presto > .tmp/hive_ddl.sql
docker cp .tmp/hive_ddl.sql "$CONTAINER_NAME":/tmp/hive_ddl.sql
docker exec "$CONTAINER_NAME" presto-cli -f /tmp/hive_ddl.sql
trap - ERR

echo "Presto running on port $PORT"
