#! /bin/bash
export PGHOST=localhost
pg_ctl -D .tmp/data/malloytestdb -l .tmp/logfile -o "--unix_socket_directories='$PWD/.tmp'" stop
rm -rf .tmp
mkdir .tmp
initdb -d .tmp/data/malloytestdb --no-locale --encoding=UTF8
pg_ctl -D .tmp/data/malloytestdb -l .tmp/logfile -o "--unix_socket_directories='$PWD/.tmp'" start
createdb $USER
gunzip -c ../data/postgres/malloytest-postgres.sql.gz | psql