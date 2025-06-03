#! /bin/bash

set -e

rm -rf .tmp
mkdir .tmp

# generate config file
> ./.tmp/mysql-pesto.properties
cat << EOF > ./.tmp/mysql-pesto.properties
connector.name=mysql
connection-url=jdbc:mysql://mysql-malloy:3306
connection-user=root
connection-password=
EOF

# run docker
docker run -p ${PRESTO_PORT:-8080}:8080 -d -v ./.tmp/mysql-pesto.properties:/opt/presto-server/etc/catalog/mysql.properties --network test-network --name presto-malloy prestodb/presto:0.287

# wait for server to start
counter=0
while ! docker logs presto-malloy 2>&1 | grep -q "SERVER STARTED"
do
  sleep 1
  counter=$((counter+1))
  # if doesn't start after 2 minutes, output logs and kill process
  if [ $counter -eq 120 ]
  then
    docker logs presto-malloy >& ./.tmp/presto-malloy.logs
    docker rm -f presto-malloy
    echo "Presto did not start successfully, check .tmp/presto-malloy.logs"
    exit 1
    break
  fi
done

echo "Presto running on port ${PRESTO_PORT:-8080}"
