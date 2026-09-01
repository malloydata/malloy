#! /bin/bash
set -e

rm -rf .tmp
mkdir .tmp

# run docker
SCRIPTDIR=$(cd $(dirname $0); pwd)
DATADIR=$(dirname $SCRIPTDIR)/data/mysql
CONTAINER_NAME="mysql-malloy"

# The image starts mysqld twice: a temporary server to initialize the data
# directory, listening on the unix socket only, and then the real server on
# 3306. Both log "mysqld: ready for connections", so the log cannot say which
# one is up. Wait on a TCP connection, which is what the loader needs.
wait_for_mysql() {
  local counter=0
  echo -n "Waiting for $CONTAINER_NAME ..."
  until docker exec "$CONTAINER_NAME" mysqladmin ping --protocol=TCP -h127.0.0.1 -uroot --silent > /dev/null 2>&1
  do
    counter=$((counter+1))
    # give up after 2 minutes
    if [ $counter -eq 60 ]
    then
      echo
      return 1
    fi
    echo -n .
    sleep 2
  done
  echo
}

# Check for existing container
if docker container inspect "$CONTAINER_NAME" > /dev/null 2>&1; then
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" = "true" ]; then
    echo "$CONTAINER_NAME is already running"
    exit 0
  fi
  echo "Restarting existing $CONTAINER_NAME container..."
  docker start "$CONTAINER_NAME"
  if ! wait_for_mysql; then
    docker logs "$CONTAINER_NAME" >& ./.tmp/mysql-malloy.logs
    echo "MySQL did not restart successfully, check .tmp/mysql-malloy.logs"
    exit 1
  fi
  echo "MySQL running on port 3306"
  exit 0
fi

docker run -p 3306:3306 -d -v $DATADIR:/init_data --name "$CONTAINER_NAME" -e MYSQL_ALLOW_EMPTY_PASSWORD=yes mysql:8.4.2

if ! wait_for_mysql; then
  docker logs "$CONTAINER_NAME" >& ./.tmp/mysql-malloy.logs
  docker rm -f "$CONTAINER_NAME"
  echo "MySQL did not start successfully, check .tmp/mysql-malloy.logs"
  exit 1
fi

# load the test data.
echo Loading Test Data
docker exec "$CONTAINER_NAME" cp /init_data/malloytest.mysql.gz /tmp
docker exec "$CONTAINER_NAME" gunzip /tmp/malloytest.mysql.gz
docker exec "$CONTAINER_NAME" mysql -P3306 -h127.0.0.1 -uroot -e 'drop database if exists malloytest; create database malloytest; use malloytest; source /tmp/malloytest.mysql;'

echo "MySQL running on port 3306"
