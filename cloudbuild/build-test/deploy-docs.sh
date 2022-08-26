#!/usr/bin/env sh
set -euxo pipefail

nix-shell --quiet --pure --command "$(cat <<NIXCMD
  cd /workspace
  git checkout main
  git pull
  git checkout docs-release
  git merge -m"update docs" main
  npm ci --silent
  bundle install
  npm run docs-build
  git status
  # add any new files -- how should we do this?
  #git add ..
  #git commit -a -m"update docs"
  #git push
NIXCMD
)"
