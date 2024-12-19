#!/bin/bash

mkdir $HOME/.snowflake
echo "$SNOWFLAKE_CONNECTION" > $HOME/.snowflake/connections.toml
chmod 0600 $HOME/.snowflake/connections.toml
