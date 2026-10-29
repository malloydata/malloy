#! /bin/bash
#
# Start a trino container whose hive catalog serves test/data/malloytest-parquet
# as the malloytest schema. The parquet is read in place; nothing is loaded.
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)
ROOTDIR=$(cd "$SCRIPTDIR/../.."; pwd)
DATADIR=$ROOTDIR/test/data/malloytest-parquet
CONTAINER_NAME="trino-malloy"
PORT=${TRINO_PORT:-8080}

cd "$ROOTDIR"
rm -rf .tmp
mkdir .tmp

# Only the log since this script started: a restarted container's old log
# already says SERVER STARTED.
SINCE=$(date -u +%Y-%m-%dT%H:%M:%SZ)

wait_for_trino() {
  local counter=0
  while ! docker logs --since "$SINCE" "$CONTAINER_NAME" 2>&1 | grep -q "SERVER STARTED"; do
    counter=$((counter+1))
    # give up after 5 minutes
    if [ $counter -eq 300 ]; then
      docker logs "$CONTAINER_NAME" >& ./.tmp/trino-malloy.logs
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
  if ! wait_for_trino; then
    echo "Trino did not restart successfully, check .tmp/trino-malloy.logs"
    exit 1
  fi
  echo "Trino running on port localhost:$PORT"
  exit 0
fi

# A hive external_location is a directory, so each parquet file gets one.
MOUNTS=()
for parquet in "$DATADIR"/*.parquet; do
  table=$(basename "$parquet" .parquet)
  MOUNTS+=(-v "$parquet:/data/malloytest/$table/$table.parquet:ro")
done

docker run -p $PORT:8080 -d -e TZ=UTC "${MOUNTS[@]}" \
  -v "$SCRIPTDIR/hive.properties:/etc/trino/catalog/hive.properties:ro" \
  --name "$CONTAINER_NAME" trinodb/trino

# A container without its tables must not survive to be "already running"
trap 'docker rm -f "$CONTAINER_NAME" > /dev/null; echo "Trino setup failed, check .tmp/trino-malloy.logs"' ERR

if ! wait_for_trino; then
  false
fi

echo "Creating the malloytest tables"
npx ts-node test/trino/hive_ddl.ts hive local:///malloytest > .tmp/hive_ddl.sql
docker cp .tmp/hive_ddl.sql "$CONTAINER_NAME":/tmp/hive_ddl.sql
docker exec "$CONTAINER_NAME" trino -f /tmp/hive_ddl.sql
trap - ERR

echo "Trino running on port localhost:$PORT"
