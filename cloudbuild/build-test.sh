#!/usr/bin/env bash

# install nix
curl -L https://nixos.org/nix/install | sh

nix-shell --quiet --command --quiet "$(cat <<NIXCMD
  yarn install
  yarn build
NIXCMD
)"
