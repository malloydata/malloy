#! /bin/bash

# clear tmp files
rm -rf .tmp

# stop container
docker rm -f malloysqlserver
