<!--
 Copyright Contributors to the Malloy project
 SPDX-License-Identifier: MIT
-->

# EXPERIMENTAL

## Especifics
There is no support for column type BIGINT (mostly because of the mssql library, it keeps bringing them back as strings (not JS bigint type even))
There is no real support for regexp
You can test with `npx dotenv -- npm run ci-sqlserver` or `npx dotenv -- npm run test-sqlserver`