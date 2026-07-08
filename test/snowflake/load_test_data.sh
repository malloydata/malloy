#! /bin/bash
#
# Load the malloytest tables into Snowflake.
#
# Requires the snowsql CLI and a configured Snowflake connection
# (~/.snowflake/connections.toml, or the SNOWFLAKE_* env vars).
#
set -e

SCRIPTDIR=$(cd $(dirname $0); pwd)

# load_test_data.sql stages files with file://../data/... paths, so it must
# run with this directory as the working directory.
cd "$SCRIPTDIR"
snowsql -f load_test_data.sql
