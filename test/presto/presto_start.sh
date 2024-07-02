#! /bin/bash
rm -rf .tmp
mkdir .tmp

# generate config file
> ./.tmp/bigquery.properties
cat << EOF > ./.tmp/bigquery.properties
connector.name=bigquery
bigquery.project-id=advance-lacing-417917
bigquery.credentials-key=$BQ_CREDENTIALS_KEY
EOF

# run docker
docker run -p 8080:8080 -d -v ./.tmp/bigquery.properties:/opt/presto-server/etc/catalog/bigquery.properties --name presto-malloy prestodb/presto:0.287

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

echo "Presto running on port 8080"