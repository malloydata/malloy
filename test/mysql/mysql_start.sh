#! /bin/bash
set -e

rm -rf .tmp
mkdir .tmp

# run docker
SCRIPTDIR=$(cd $(dirname $0); pwd)
DATADIR=$(dirname $SCRIPTDIR)/data/mysql
CONTAINER_NAME="mysql-malloy"

# Check for existing container
if docker container inspect "$CONTAINER_NAME" > /dev/null 2>&1; then
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" = "true" ]; then
    echo "$CONTAINER_NAME is already running"
    exit 0
  fi
  echo "Restarting existing $CONTAINER_NAME container..."
  docker start "$CONTAINER_NAME"
  while ! docker logs "$CONTAINER_NAME" 2>&1 | grep -q "mysqld: ready for connections"; do
    sleep 2
  done
  echo "MySQL running on port 3306"
  exit 0
fi

docker run -p 3306:3306 -d -v $DATADIR:/init_data --name "$CONTAINER_NAME" -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -d mysql:8.4.2

# wait for server to start
counter=0
echo -n Starting Docker ...
while ! docker logs "$CONTAINER_NAME" 2>&1 | grep -q "mysqld: ready for connections"
do
  sleep 10
  counter=$((counter+1))
  # if doesn't start after 2 minutes, output logs and kill process
  if [ $counter -eq 120 ]
  then
    docker logs "$CONTAINER_NAME" >& ./.tmp/mysql-malloy.logs
    docker rm -f "$CONTAINER_NAME"
    echo "MySQL did not start successfully, check .tmp/mysql-malloy.logs"
    exit 1
    break
  fi
  echo -n ...
done

# load the test data.
echo
echo Loading Test Data
docker exec "$CONTAINER_NAME" cp /init_data/malloytest.mysql.gz /tmp
docker exec "$CONTAINER_NAME" gunzip /tmp/malloytest.mysql.gz
docker exec "$CONTAINER_NAME" mysql -P3306 -h127.0.0.1 -uroot -e 'drop database if exists malloytest; create database malloytest; use malloytest; source /tmp/malloytest.mysql;'

echo "MySQL running on port 3306"
