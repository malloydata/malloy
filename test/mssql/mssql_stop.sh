#!/bin/bash

# stop and remove the container mssql_start.sh started
docker rm -f "${MSSQL_CONTAINER:-mssql-malloy}"
