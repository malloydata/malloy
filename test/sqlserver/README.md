<!--
 Copyright Contributors to the Malloy project
 SPDX-License-Identifier: MIT
-->

# Setting up tests
## .env
Have a <root>/.env file with this in it:
```shell
SQLSERVER_USER=SA
SQLSERVER_HOST=localhost
SQLSERVER_PORT=1433
SQLSERVER_PASSWORD=saTEST_0pword
SQLSERVER_DATABASE=malloytestdb
SQLSERVER_SCHEMA=malloytest
SQLSERVER_ENCRYPT=true
SQLSERVER_TRUST_SERVER_CERTIFICATE=true
```

## Start/Populate the sqlserver instance on docker
```sh
<root>/test/sqlserver/sqlserver_start.sh
```

## Stop the sqlserver instance (you might have to stop and restart if something weird happens)
```sh
<root>/test/sqlserver/sqlserver_stop.sh
```

## Running tests
```sh
npx dotenv -- npm run ci-sqlserver
```
```shell
npx dotenv -- npm run test-sqlserver
```
