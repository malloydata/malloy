#! /bin/sh
#
# Copyright 2022 Google LLC
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# version 2 as published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#

# Silly little hack to make it only run ANTLR when the grammar actually changes
# BUG: If you go in $lib and delete a file which isn't MalloyParser.ts
# this hack will fail. `npm run clean`` will fix things though.

set -e
lib="../lib/Malloy"
digest=$lib/Malloy.md5
target=$lib/MalloyParser.ts

if command -v md5sum > /dev/null; then
  newmd5=`md5sum Malloy.g4`
elif command -v md5 > /dev/null; then
  newmd5=`md5 Malloy.g4`
else
  echo "build_parser: MD5 checksum program not found, assuming rebuild"
  newmd5=`date`
fi

oldmd5="--MISSING-DIGEST--"
if [  -e $digest ]; then
  oldmd5=`cat $digest`
fi
if [ ! -r $target ]; then
  oldmd5="--MISSING-PARSER--"
fi

if [ "$oldmd5" != "$newmd5" ]; then
  antlr4ts -visitor -o $lib Malloy.g4 && echo "$newmd5" > $digest
else
  echo "ANTLR parser $target is up to date"
fi
