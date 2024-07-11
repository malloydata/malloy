#! /bin/bash
rm -rf .tmp
mkdir .tmp

# generate config file
> ./.tmp/bigquery.properties
cat << EOF > ./.tmp/bigquery.properties
connector.name=bigquery
bigquery.project-id=advance-lacing-417917
bigquery.credentials-key=$BQ_CREDENTIALS_KEY
bigquery.arrow-serialization.enabled=false
EOF

# run docker
docker run -p 8090:8090 -d -v ./.tmp/bigquery.properties:/etc/trino/catalog/bigquery.properties --name trino-malloy trinodb/trino

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

echo "Trino running on port localhost:8090"