#! /bin/bash
export PGHOST=localhost
mkdir .tmp
initdb -d .tmp/data/malloytestdb --no-locale --encoding=UTF8
pg_ctl -D .tmp/data/malloytestdb -l .tmp/logfile -o "--unix_socket_directories='$PWD/.tmp'" start
createdb $USER
gunzip -c malloytest-postgres.sql.gz | psql