-- To run: sh test/snowflake/load_test_data.sh


drop database malloytest;
create database malloytest;

use malloytest;
create schema malloytest;

-- Pin UTC so the TIMESTAMP_LTZ -> TIMESTAMP_NTZ conversion at the end of this
-- script is a lossless wall-clock identity (the parquet data is stored as UTC
-- instants).
ALTER SESSION SET TIMEZONE = 'UTC';

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

-- INFER_SCHEMA maps timezone-aware parquet timestamps to TIMESTAMP_LTZ, which
-- the Malloy Snowflake dialect does not support (it degrades to `sql native`,
-- breaking time truncation and year()/quarter()). Rewrite every TIMESTAMP_LTZ
-- column in the schema to TIMESTAMP_NTZ. Snowflake has no in-place retype
-- between timestamp variants, so each column is rebuilt via add / copy / drop /
-- rename; the UTC session pin above makes the copy preserve the stored instant
-- exactly. The columns are discovered dynamically so this stays correct if the
-- test corpus gains or loses a timestamp column. Wrapped in EXECUTE IMMEDIATE
-- $$...$$ so it is a single statement (snowsql splits input on ';').
EXECUTE IMMEDIATE $$
DECLARE
  ltz_cols CURSOR FOR
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = CURRENT_SCHEMA() AND DATA_TYPE = 'TIMESTAMP_LTZ';
BEGIN
  FOR col IN ltz_cols DO
    EXECUTE IMMEDIATE 'ALTER TABLE malloytest.' || col.TABLE_NAME || ' ADD COLUMN "' || col.COLUMN_NAME || '__ntz" TIMESTAMP_NTZ';
    EXECUTE IMMEDIATE 'UPDATE malloytest.' || col.TABLE_NAME || ' SET "' || col.COLUMN_NAME || '__ntz" = "' || col.COLUMN_NAME || '"::TIMESTAMP_NTZ';
    EXECUTE IMMEDIATE 'ALTER TABLE malloytest.' || col.TABLE_NAME || ' DROP COLUMN "' || col.COLUMN_NAME || '"';
    EXECUTE IMMEDIATE 'ALTER TABLE malloytest.' || col.TABLE_NAME || ' RENAME COLUMN "' || col.COLUMN_NAME || '__ntz" TO "' || col.COLUMN_NAME || '"';
  END FOR;
  RETURN 'normalized timestamp_ltz columns to timestamp_ntz';
END;
$$;
