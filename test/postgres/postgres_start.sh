#! /bin/bash
#
# Setup postgres as a docker container
#
set -e

rm -rf .tmp
mkdir .tmp

# run docker
SCRIPTDIR=$(cd $(dirname $0); pwd)
DATADIR=$(dirname $SCRIPTDIR)/data/postgres

// set these in your enviornment
export PGHOST=localhost
export PGPORT=5432
export PGUSER=root
export PGPASSWORD=postgres

docker run -p 5432:5432 -d -v $DATADIR:/init_data \
 --name postgres-malloy \
  -e POSTGRES_USER=root -e POSTGRES_PASSWORD=postgres \
  --health-cmd pg_isready \
  --health-interval 10s \
  --health-timeout 5s \
  --health-retries 5 \
  -d postgres

CONTAINER_NAME="postgres-malloy"

echo "Waiting for container $CONTAINER_NAME to become healthy..."

while [ "$(docker inspect -f {{.State.Health.Status}} $CONTAINER_NAME)" != "healthy" ]; do
    sleep 2; # Adjust the sleep duration as needed
done

echo "Container $CONTAINER_NAME is now healthy!"

#  configure
echo CREATE EXTENSION tsm_system_rows\; | psql
gunzip -c ${DATADIR}/malloytest-postgres.sql.gz | psql
