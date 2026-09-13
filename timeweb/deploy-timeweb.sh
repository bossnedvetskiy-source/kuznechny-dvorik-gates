#!/bin/sh
set -eu

cd "$(dirname "$0")"

git fetch --quiet --depth=1 origin timeweb-public
new_commit=$(git rev-parse --short FETCH_HEAD)
current_commit=$(git rev-parse --short HEAD 2>/dev/null || printf 'none')

if [ "$current_commit" != "$new_commit" ]; then
  git reset --hard --quiet FETCH_HEAD
  echo "Timeweb updated: $current_commit -> $new_commit"
else
  echo "Timeweb already current: $current_commit"
fi

if [ -f ./health-check.sh ]; then
  /bin/sh ./health-check.sh
fi
