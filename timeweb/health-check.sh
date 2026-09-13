#!/bin/sh
set -eu

BASE_URL="https://kuzdvor.tw1.ru"
TMP_DIR="${TMPDIR:-/tmp}/kuzdvor-timeweb-health-$$"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

fail() {
  echo "HEALTHCHECK FAIL: $*" >&2
  exit 1
}

fetch() {
  url="$1"
  out="$2"
  curl --fail --silent --show-error --location --max-time 25 "$url" -o "$out"
}

# Main page and critical static assets.
fetch "$BASE_URL/" "$TMP_DIR/index.html"
grep -q 'Кузнечный Дворик' "$TMP_DIR/index.html" || fail 'main page marker missing'
grep -q 'site.bundle.js' "$TMP_DIR/index.html" || fail 'site.bundle.js reference missing'
grep -q 'site.css' "$TMP_DIR/index.html" || fail 'site.css reference missing'
fetch "$BASE_URL/site.css" "$TMP_DIR/site.css"
fetch "$BASE_URL/site.bundle.js" "$TMP_DIR/site.bundle.js"
fetch "$BASE_URL/admin" "$TMP_DIR/admin.html"
grep -q 'Админ-панель' "$TMP_DIR/admin.html" || fail 'admin page marker missing'
fetch "$BASE_URL/vorota" "$TMP_DIR/vorota.html"
fetch "$BASE_URL/napravleniya" "$TMP_DIR/napravleniya.html"

# Transitional API proxy.
fetch "$BASE_URL/api/catalog-images" "$TMP_DIR/catalog.json"
grep -q '"galleries"' "$TMP_DIR/catalog.json" || fail 'catalog API response invalid'

curl --fail --silent --show-error --location --max-time 35 \
  --get --data-urlencode 'place=Стерлитамак' \
  "$BASE_URL/api/delivery" -o "$TMP_DIR/delivery.json"
grep -q '"distanceKm"' "$TMP_DIR/delivery.json" || fail 'delivery API response invalid'

status=$(curl --silent --show-error --location --max-time 25 \
  --output "$TMP_DIR/admin-api.json" --write-out '%{http_code}' \
  "$BASE_URL/api/admin/site-settings")
[ "$status" = '401' ] || fail "admin API should require auth, got HTTP $status"

# Direct proxy call must not expose backend functionality without a routed path.
status=$(curl --silent --show-error --max-time 25 \
  --output "$TMP_DIR/proxy-direct.txt" --write-out '%{http_code}' \
  "$BASE_URL/api-proxy.php")
[ "$status" = '404' ] || fail "direct api-proxy.php expected 404, got HTTP $status"

# Repository metadata must not be public.
status=$(curl --silent --show-error --max-time 25 \
  --output /dev/null --write-out '%{http_code}' \
  "$BASE_URL/.git/config")
[ "$status" != '200' ] || fail '.git/config is publicly accessible'

commit=$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')
printf 'ok\nchecked_at=%s\ncommit=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$commit" > .timeweb-health
printf 'Timeweb health check OK (%s)\n' "$commit"
