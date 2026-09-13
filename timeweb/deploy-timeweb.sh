#!/bin/sh
set -eu

PATH=/usr/local/bin:/usr/bin:/bin
export PATH

SITE_DIR="${KUZDVOR_SITE_DIR:-$(cd "$(dirname "$0")" && pwd)}"
LOCK_DIR="${HOME}/.cache/kuzdvor-autodeploy.lock"
mkdir -p "${HOME}/.cache"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT INT TERM

cd "$SITE_DIR"

old_commit=$(git rev-parse HEAD)
git fetch --quiet --depth=1 origin timeweb-public
new_commit=$(git rev-parse FETCH_HEAD)

if [ "$old_commit" = "$new_commit" ]; then
  exit 0
fi

old_short=$(printf '%s' "$old_commit" | cut -c1-8)
new_short=$(printf '%s' "$new_commit" | cut -c1-8)

echo "$(date '+%Y-%m-%d %H:%M:%S') update $old_short -> $new_short"
git reset --hard --quiet FETCH_HEAD

if /bin/sh ./health-check.sh; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') deploy OK $new_short"
  exit 0
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') health check failed, rolling back to $old_short" >&2
git reset --hard --quiet "$old_commit"

if /bin/sh ./health-check.sh; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') rollback OK $old_short" >&2
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') rollback health check also failed" >&2
fi

exit 1
