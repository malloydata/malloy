#! /bin/bash

# Copyright Contributors to the Malloy project
# SPDX-License-Identifier: MIT

# clear tmp files
rm -rf .tmp

# stop container
docker rm -f malloysqlserver
