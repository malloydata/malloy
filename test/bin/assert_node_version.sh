#!/usr/bin/env bash
# Simple test to assert that `.node-version` is up to date that runs via nix during CI 

# cd into `malloy/` (git root)
cd "$(git rev-parse --show-toplevel)"

# fetch the node version and compare it to `malloy/.node-version`
diff <(node --version | cut -c 2-) .node-version

# check the results of diff via its exit code `$?`
if [[ "$?" != "0" ]]; then
  # writes to stderr
  >&2 echo "error: please update .node-version"

  # exit with non-zero (successful) status
  exit 1
fi

echo ".node-version matches"
