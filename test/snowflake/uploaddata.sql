-- to run

-- cd test/snowflake
-- snowsql -f uploaddata.sql


drop database malloytest;
create database malloytest;

use malloytest;
create schema malloytest;

CREATE OR REPLACE FILE FORMAT PARQUET_SCHEMA_DETECTION
  TYPE = PARQUET
  BINARY_AS_TEXT = FALSE
  USE_LOGICAL_TYPE = TRUE;

PUT file://../data/malloytest-parquet/aircraft.parquet @~/staged;

CREATE OR REPLACE TABLE aircraft
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/aircraft.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.aircraft
FROM '@~/staged/aircraft.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/malloytest-parquet/aircraft_models.parquet @~/staged;

CREATE OR REPLACE TABLE aircraft_models
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/aircraft_models.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.aircraft_models
FROM '@~/staged/aircraft_models.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/malloytest-parquet/airports.parquet @~/staged;

CREATE OR REPLACE TABLE airports
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/airports.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.airports
FROM '@~/staged/airports.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/malloytest-parquet/alltypes.parquet @~/staged;

CREATE OR REPLACE TABLE alltypes
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/alltypes.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.alltypes
FROM '@~/staged/alltypes.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/malloytest-parquet/carriers.parquet @~/staged;

CREATE OR REPLACE TABLE carriers
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/carriers.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.carriers
FROM '@~/staged/carriers.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/malloytest-parquet/flights.parquet @~/staged;

CREATE OR REPLACE TABLE flights
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/flights.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.flights
FROM '@~/staged/flights.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/duckdb/flights_partitioned.parquet @~/staged;

CREATE OR REPLACE TABLE flights_partitioned
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/flights_partitioned.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.flights_partitioned
FROM '@~/staged/flights_partitioned.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/malloytest-parquet/ga_sample.parquet @~/staged;

CREATE OR REPLACE TABLE ga_sample
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/ga_sample.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.ga_sample
FROM '@~/staged/ga_sample.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/duckdb/numbers.parquet @~/staged;

CREATE OR REPLACE TABLE numbers
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/numbers.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.numbers
FROM '@~/staged/numbers.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/malloytest-parquet/state_facts.parquet @~/staged;

CREATE OR REPLACE TABLE state_facts
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/state_facts.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.state_facts
FROM '@~/staged/state_facts.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/duckdb/words.parquet @~/staged;

CREATE OR REPLACE TABLE words
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/words.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.words
FROM '@~/staged/words.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;

PUT file://../data/duckdb/words_bigger.parquet @~/staged;

CREATE OR REPLACE TABLE words_bigger
    USING TEMPLATE (
        SELECT ARRAY_AGG(OBJECT_CONSTRUCT(*))
        FROM TABLE(
            INFER_SCHEMA(
            LOCATION=>'@~/staged/words_bigger.parquet',
            FILE_FORMAT => 'PARQUET_SCHEMA_DETECTION')
        )
    );

COPY INTO malloytest.words_bigger
FROM '@~/staged/words_bigger.parquet'
FILE_FORMAT = 'PARQUET_SCHEMA_DETECTION'
MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE
ON_ERROR = CONTINUE;
