#! /bin/bash

# Copyright Contributors to the Malloy project
# SPDX-License-Identifier: MIT

set -e

rm -rf .tmp
mkdir .tmp

USERNAME=SA
PASSWORD=saTEST_0pword
CONTAINER_NAME=malloysqlserver
SERVER_NAME=$CONTAINER_NAME
DATABASE_NAME=malloytestdb

# check if the container exists
if [ "$(docker ps -a -q -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "Container '${CONTAINER_NAME}' exists. Removing it..."
    # remove the container forcefully (even if running)
    docker rm -f "${CONTAINER_NAME}"
else
    echo "Container '${CONTAINER_NAME}' does not exist."
fi

# run docker
SCRIPTDIR=$(cd $(dirname $0); pwd)
echo "SCRIPTDIR is $SCRIPTDIR"
DATADIR=$(dirname $SCRIPTDIR)/data/sqlserver
echo "DATADIR is $DATADIR"

docker run \
  -p 1433:1433 -v $DATADIR:/init_data --name $CONTAINER_NAME --hostname $CONTAINER_NAME -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=$PASSWORD" -d vitorelourenco/sqlserver:v0.0.1

# wait for server to start
counter=0
echo -n Starting SQL Server Docker...

while ! docker logs $CONTAINER_NAME 2>&1 | grep -q "SQL Server is now ready for client connections"
do
  sleep 10
  counter=$((counter+1))
  # if doesn't start after 2 minutes, output logs and kill process
  if [ $counter -eq 12 ]
  then
    docker logs $CONTAINER_NAME >& "./.tmp/$CONTAINER_NAME.logs"
    docker rm -f $CONTAINER_NAME
    echo "SQL Server did not start successfully, check .tmp/$CONTAINER_NAME.logs"
    exit 1
    break
  fi
  echo -n ...
done

# load the test data.
echo
echo Loading Test Data
docker exec $CONTAINER_NAME tar -xzvf /init_data/malloytest-sqlserver.tar.gz -C /tmp
echo Volume mounted
docker exec $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd -S localhost -U $USERNAME -P "$PASSWORD" -Q "IF EXISTS (SELECT * FROM sys.databases WHERE name = '$DATABASE_NAME') BEGIN DROP DATABASE [$DATABASE_NAME]; END; CREATE DATABASE [$DATABASE_NAME];"
echo Database created
docker exec $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd -S $SERVER_NAME -d $DATABASE_NAME -U $USERNAME -P "$PASSWORD" -i "/tmp/malloytest-sqlserver.sql"
echo Schema created
docker exec -e USERNAME=$USERNAME -e PASSWORD=$PASSWORD -e DATABASE_NAME=$DATABASE_NAME -e SERVER_NAME=$SERVER_NAME $CONTAINER_NAME /tmp/seed/seed.sh
echo Seed completed

# Lib consumers will have to run this somehow. Idk where to put it.
echo Creating malloynumbers table
docker exec $CONTAINER_NAME /opt/mssql-tools/bin/sqlcmd -S $SERVER_NAME -d $DATABASE_NAME -U $USERNAME -P "$PASSWORD" -Q "
IF OBJECT_ID('[dbo].malloynumbers', 'U') IS NULL
    BEGIN
        PRINT 'Creating [dbo].malloynumbers...';
        CREATE TABLE [dbo].malloynumbers (
            n INT NOT NULL PRIMARY KEY
        );
        PRINT 'Populating [dbo].malloynumbers with 10 million rows...';
        ;WITH
        E1 AS (SELECT 1 AS n FROM (VALUES(1),(1),(1),(1),(1),(1),(1),(1),(1),(1)) AS x(n)), -- 10
        E2 AS (SELECT 1 AS n FROM E1 AS a CROSS JOIN E1 AS b),                             -- 100
        E3 AS (SELECT 1 AS n FROM E2 AS a CROSS JOIN E2 AS b),                             -- 10,000
        E4 AS (SELECT 1 AS n FROM E3 AS a CROSS JOIN E2 AS b),                             -- 1,000,000
        E5 AS (SELECT 1 AS n FROM E4 AS a CROSS JOIN E1 AS b),                             -- 10,000,000
        Tally AS (
            SELECT TOP (10000000)
                  ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n
            FROM E5
        )
        INSERT INTO [dbo].malloynumbers (n)
        SELECT n FROM Tally
        OPTION (MAXRECURSION 0);
        PRINT '[dbo].malloynumbers created and populated.';
    END
    ELSE
    BEGIN
        PRINT '[dbo].malloynumbers already exists. Skipping creation.';
    END;
"

echo malloynumbers table creation completed

echo "SQL Server running on port 1433"
