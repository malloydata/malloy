#!/bin/bash

# HOW TO USE:
## 1) Run this script
## 2) Install snowsql command line tool
## 3) Open snowsql, copy the output of this script and run inside the shell

SCRIPT_PATH=$(readlink -f $0)
MALLOY_ROOT="${SCRIPT_PATH%/*/*}"
DATA_DIR="${MALLOY_ROOT}/test/data/duckdb"

# https://medium.com/snowflake/data-loading-schematization-with-snowflake-d75d9bbd3bee
echo $DATA_DIR

pushd ${DATA_DIR}

# -- Create a file format that sets the file type as Parquet.
format="CREATE OR REPLACE FILE FORMAT PARQUET_SCHEMA_DETECTION
  TYPE = PARQUET
  BINARY_AS_TEXT = FALSE;"
echo -ne "${format}\n\n"

for table in $(ls *.parquet|awk -F. '{print $1}'); do
  echo -ne "PUT file://${DATA_DIR}/${table}.parquet @~/staged;\n"
  ddl="
CREATE OR REPLACE TABLE ${table}
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/${table}.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO ${table}
FROM '@~/staged/${table}.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;
"
  echo -e "${ddl}"
done

popd
