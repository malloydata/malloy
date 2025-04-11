#! /bin/bash
set -e

rm -rf .tmp
mkdir .tmp

# run docker
SCRIPTDIR=$(cd $(dirname $0); pwd)
DATADIR=$(dirname $SCRIPTDIR)/data/sqlserver
docker run \
  -p 1433:1433 -d -v $DATADIR:/init_data --name sqlserver-malloy --hostname sqlserver-malloy -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=saTEST_0pword" -d mcr.microsoft.com/mssql/server:2022-latest

# wait for server to start
counter=0
echo -n Starting Docker ...
while ! docker logs sqlserver-malloy 2>&1 | grep -q "SQLServer: ready for connections"
do
  sleep 10
  counter=$((counter+1))
  # if doesn't start after 2 minutes, output logs and kill process
  if [ $counter -eq 120 ]
  then
    docker logs sqlserver-malloy >& ./.tmp/sqlserver-malloy.logs
    docker rm -f sqlserver-malloy
    echo "SqlServer did not start successfully, check .tmp/sqlserver-malloy.logs"
    exit 1
    break
  fi
  echo -n ...
done

# load the test data.
echo
echo Loading Test Data
docker exec sqlserver-malloy cp /init_data/malloytest.sqlserver.gz /tmp
docker exec sqlserver-malloy gunzip /tmp/malloytest.sqlserver.gz
docker exec sqlserver-malloy sqlserver -P1433 -h127.0.0.1 -uroot -e 'drop database if exists malloytest; create database malloytest; use malloytest; source /tmp/malloytest.sqlserver;'

echo "SqlServer running on port 1433"
