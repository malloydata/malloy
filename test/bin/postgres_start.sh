#! /bin/bash

SCRIPT_DIR=$(realpath $(dirname "$0"))
source ${SCRIPT_DIR}/postgres_vars.sh

echo "starting postgres"

pg_ctl -D ${TEST_DB_DIR} -l ${LOCAL_TMP_DIR}/logfile -o "--unix_socket_directories='${LOCAL_TMP_DIR}'" start