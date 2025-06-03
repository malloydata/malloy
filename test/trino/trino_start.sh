#! /bin/bash

set -e

rm -rf .tmp
mkdir .tmp

# generate config file
> ./.tmp/mysql-trino.properties
cat << EOF > ./.tmp/mysql-trino.properties
connector.name=mysql
connection-url=jdbc:mysql://mysql-malloy:3306
connection-user=root
connection-password=
EOF

# run docker
docker run -p ${TRINO_PORT:-8080}:8080 -d -v ./.tmp/mysql-trino.properties:/etc/trino/catalog/mysql.properties --network test-network --name trino-malloy trinodb/trino

# wait for server to start
counter=0
while ! docker logs trino-malloy 2>&1 | grep -q "SERVER STARTED"
do
  sleep 1
  counter=$((counter+1))
  # if doesn't start after 2 minutes, output logs and kill process
  if [ $counter -eq 300 ]
  then
    docker logs trino-malloy >& ./.tmp/trino-malloy.logs
    docker rm -f trino-malloy
    echo "Trino did not start successfully, check .tmp/trino-malloy.logs"
    exit 1
    break
  fi
done

echo "Trino running on port localhost:8080"
