#!/bin/sh
set -eu

cd "$(dirname "$0")"
git fetch --quiet --depth=1 origin timeweb-public
git reset --hard --quiet FETCH_HEAD
