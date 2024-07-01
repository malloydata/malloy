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
# docker run -p 8080:8080 -ti -v ./bigquery.properties:/opt/presto-server/etc/catalog/bigquery.properties -name presto-malloy prestodb/presto:latest

# how to know when ready?

# how to connect to query?