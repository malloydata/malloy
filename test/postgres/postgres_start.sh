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

# Verify required environment variables and show export commands for any that are wrong
EXPORTS=""

if [ -z "$PGHOST" ] || [ "$PGHOST" != "localhost" ]; then
  EXPORTS="${EXPORTS}export PGHOST=localhost\n"
fi

if [ -z "$PGPORT" ] || [ "$PGPORT" != "5432" ]; then
  EXPORTS="${EXPORTS}export PGPORT=5432\n"
fi

if [ -z "$PGUSER" ] || [ "$PGUSER" != "root" ]; then
  EXPORTS="${EXPORTS}export PGUSER=root\n"
fi

if [ -z "$PGPASSWORD" ] || [ "$PGPASSWORD" != "postgres" ]; then
  EXPORTS="${EXPORTS}export PGPASSWORD=postgres\n"
fi

if [ -n "$EXPORTS" ]; then
  echo "Required environment variables are missing or incorrect."
  echo "Run these commands in your current shell or add them to your shell startup file (~/.bashrc, ~/.zshrc, etc.):"
  echo ""
  echo -e "$EXPORTS"
  exit 1
fi

docker run -p 5432:5432 -d -v $DATADIR:/init_data \
 --name postgres-malloy \
  -e POSTGRES_USER=root -e POSTGRES_PASSWORD=postgres \
  -e TZ=UTC \
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

echo "Loading data ..."
#  configure
echo CREATE EXTENSION tsm_system_rows\; | psql
gunzip -c ${DATADIR}/malloytest-postgres.sql.gz | psql

echo "Ready"
