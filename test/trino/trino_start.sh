#! /bin/bash

set -e

rm -rf .tmp
mkdir .tmp


if [ "x${BQ_CREDENTIALS_KEY}" = x ]; then
  echo "######### BQ_CREDENTIALS_KEY is not set. Cannot start Trino"
  exit 1
fi
# generate config file
> ./.tmp/bigquery-trino.properties
cat << EOF > ./.tmp/bigquery-trino.properties
connector.name=bigquery
bigquery.project-id=advance-lacing-417917
bigquery.credentials-key=$BQ_CREDENTIALS_KEY
bigquery.arrow-serialization.enabled=false
EOF

CONTAINER_NAME="trino-malloy"

# Check for existing container
if docker container inspect "$CONTAINER_NAME" > /dev/null 2>&1; then
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" = "true" ]; then
    echo "$CONTAINER_NAME is already running"
    exit 0
  fi
  echo "Restarting existing $CONTAINER_NAME container..."
  docker start "$CONTAINER_NAME"
  while ! docker logs "$CONTAINER_NAME" 2>&1 | grep -q "SERVER STARTED"; do
    sleep 1
  done
  echo "Trino running on port localhost:8080"
  exit 0
fi

# run docker
docker run -p ${TRINO_PORT:-8080}:8080 -d -e TZ=UTC -v ./.tmp/bigquery-trino.properties:/etc/trino/catalog/bigquery.properties --name "$CONTAINER_NAME" trinodb/trino

# wait for server to start
counter=0
while ! docker logs "$CONTAINER_NAME" 2>&1 | grep -q "SERVER STARTED"
do
  sleep 1
  counter=$((counter+1))
  # if doesn't start after 2 minutes, output logs and kill process
  if [ $counter -eq 300 ]
  then
    docker logs "$CONTAINER_NAME" >& ./.tmp/trino-malloy.logs
    docker rm -f "$CONTAINER_NAME"
    echo "Trino did not start successfully, check .tmp/trino-malloy.logs"
    exit 1
    break
  fi
done

echo "Trino running on port localhost:8080"
