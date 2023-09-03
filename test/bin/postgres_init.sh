#! /bin/bash

export PGHOST=localhost

SCRIPT_DIR=$(realpath $(dirname "$0"))
source ${SCRIPT_DIR}/postgres_vars.sh

${SCRIPT_DIR}/postgres_stop.sh

echo "removing postgres data files"

rm -rf ${LOCAL_TMP_DIR}
mkdir ${LOCAL_TMP_DIR}

echo "initializing postgres database"

initdb -d ${TEST_DB_DIR} --no-locale --encoding=UTF8

${SCRIPT_DIR}/postgres_start.sh

echo "creating user"

createdb ${USER}

echo "seeding malloy test data"

echo "CREATE EXTENSION tsm_system_rows;" | psql

gunzip -c ${SCRIPT_DIR}/../data/postgres/malloytest-postgres.sql.gz | psql