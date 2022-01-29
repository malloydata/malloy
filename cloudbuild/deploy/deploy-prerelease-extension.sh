#!/usr/bin/env sh
set -euxo pipefail

nix-shell --pure --command "$(cat <<NIXCMD
  cd /workspace
  export VSCE_PAT=builtins.getEnv "VSCE_PAT"
  echo $VSCE_PAT
NIXCMD
)"