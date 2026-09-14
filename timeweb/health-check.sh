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

fetch_local_api() {
  url="$1"
  out="$2"
  headers="$3"
  curl --fail --silent --show-error --location --max-time 35 -D "$headers" "$url" -o "$out"
  grep -qi '^X-Kuzdvor-Backend: timeweb-php' "$headers" || fail "local backend marker missing for $url"
}

# Main page and critical static assets.
fetch "$BASE_URL/" "$TMP_DIR/index.html"
grep -q 'Кузнечный Дворик' "$TMP_DIR/index.html" || fail 'main page marker missing'
grep -q 'site.bundle.js' "$TMP_DIR/index.html" || fail 'site.bundle.js reference missing'
grep -q 'site.css' "$TMP_DIR/index.html" || fail 'site.css reference missing'
grep -q 'content="index,follow,max-image-preview:large"' "$TMP_DIR/index.html" || fail 'main page is not indexable'
grep -q '<link rel="canonical" href="https://kuzdvor.tw1.ru/">' "$TMP_DIR/index.html" || fail 'main page canonical is invalid'
grep -q '<meta property="og:url" content="https://kuzdvor.tw1.ru/">' "$TMP_DIR/index.html" || fail 'main page og:url is invalid'
if grep -qi 'noindex' "$TMP_DIR/index.html"; then
  fail 'main page is accidentally noindexed'
fi
if grep -qi 'workers\.dev' "$TMP_DIR/index.html"; then
  fail 'main page still references Cloudflare Workers'
fi
fetch "$BASE_URL/robots.txt" "$TMP_DIR/robots.txt"
grep -q '^User-agent: \*$' "$TMP_DIR/robots.txt" || fail 'robots.txt is invalid'
grep -q '^Allow: /$' "$TMP_DIR/robots.txt" || fail 'robots.txt does not allow the public site'
grep -q '^Disallow: /admin$' "$TMP_DIR/robots.txt" || fail 'robots.txt does not protect admin crawling'
grep -q '^Sitemap: https://kuzdvor.tw1.ru/sitemap.xml$' "$TMP_DIR/robots.txt" || fail 'robots.txt sitemap URL is invalid'
fetch "$BASE_URL/sitemap.xml" "$TMP_DIR/sitemap.xml"
grep -q '<loc>https://kuzdvor.tw1.ru/</loc>' "$TMP_DIR/sitemap.xml" || fail 'sitemap is missing the main page'
grep -q '<loc>https://kuzdvor.tw1.ru/napravleniya</loc>' "$TMP_DIR/sitemap.xml" || fail 'sitemap is missing the directions page'
fetch "$BASE_URL/site.css" "$TMP_DIR/site.css"
fetch "$BASE_URL/site.bundle.js" "$TMP_DIR/site.bundle.js"
fetch "$BASE_URL/admin" "$TMP_DIR/admin.html"
grep -q 'Админ-панель' "$TMP_DIR/admin.html" || fail 'admin page marker missing'
grep -q 'noindex,nofollow,noarchive' "$TMP_DIR/admin.html" || fail 'admin page must be noindexed'
grep -q '<script src="/xlsx.bundle.js"></script>' "$TMP_DIR/admin.html" || fail 'external XLSX bundle reference missing from admin page'
if grep -q 'unsupported format' "$TMP_DIR/admin.html"; then
  fail 'XLSX source leaked into visible admin HTML'
fi
fetch "$BASE_URL/xlsx.bundle.js" "$TMP_DIR/xlsx.bundle.js"
grep -q 'xlsx.js' "$TMP_DIR/xlsx.bundle.js" || fail 'XLSX bundle invalid'
fetch "$BASE_URL/vorota" "$TMP_DIR/vorota.html"
fetch "$BASE_URL/napravleniya" "$TMP_DIR/napravleniya.html"
if grep -qi 'noindex' "$TMP_DIR/napravleniya.html"; then
  fail 'directions page is accidentally noindexed'
fi
if grep -qi 'workers\.dev' "$TMP_DIR/napravleniya.html"; then
  fail 'directions page still references Cloudflare Workers'
fi

# Production API must be served by the local Timeweb PHP/MySQL backend.
fetch_local_api "$BASE_URL/api/health" "$TMP_DIR/health.json" "$TMP_DIR/health.headers"
grep -q '"backend":"timeweb-php"' "$TMP_DIR/health.json" || fail 'local PHP backend health marker missing'
grep -q '"configured":true' "$TMP_DIR/health.json" || fail 'local backend is not configured'
grep -q '"db":true' "$TMP_DIR/health.json" || fail 'local MySQL connection failed'
grep -q '"ok":true' "$TMP_DIR/health.json" || fail 'local backend health is not OK'

fetch_local_api "$BASE_URL/api/catalog-images" "$TMP_DIR/catalog.json" "$TMP_DIR/catalog.headers"
grep -q '"galleries"' "$TMP_DIR/catalog.json" || fail 'catalog API response invalid'

curl --fail --silent --show-error --location --max-time 35 -D "$TMP_DIR/delivery.headers" \
  --get --data-urlencode 'place=Стерлитамак' \
  "$BASE_URL/api/delivery" -o "$TMP_DIR/delivery.json"
grep -qi '^X-Kuzdvor-Backend: timeweb-php' "$TMP_DIR/delivery.headers" || fail 'delivery is not served by Timeweb PHP'
grep -q '"distanceKm"' "$TMP_DIR/delivery.json" || fail 'delivery API response invalid'

status=$(curl --silent --show-error --location --max-time 25 -D "$TMP_DIR/admin-api.headers" \
  --output "$TMP_DIR/admin-api.json" --write-out '%{http_code}' \
  "$BASE_URL/api/admin/site-settings")
[ "$status" = '401' ] || fail "admin API should require auth, got HTTP $status"
grep -qi '^X-Kuzdvor-Backend: timeweb-php' "$TMP_DIR/admin-api.headers" || fail 'admin API is not served by Timeweb PHP'

# Legacy Cloudflare proxy and one-time helpers must be absent/inaccessible.
for legacy in \
  'api-proxy.php?__proxy_path=api/health' \
  'setup-timeweb.php' \
  'migrate-from-cloudflare.php' \
  'migrate-public-catalog.php'
do
  status=$(curl --silent --show-error --max-time 25 --output /dev/null --write-out '%{http_code}' "$BASE_URL/$legacy" || true)
  case "$status" in
    403|404) ;;
    *) fail "legacy helper $legacy must not be public, got HTTP ${status:-000}" ;;
  esac
done

# Repository/backend internals must not be public.
status=$(curl --silent --show-error --max-time 25 --output /dev/null --write-out '%{http_code}' "$BASE_URL/.git/config")
[ "$status" != '200' ] || fail '.git/config is publicly accessible'
status=$(curl --silent --show-error --max-time 25 --output /dev/null --write-out '%{http_code}' "$BASE_URL/backend/schema.mysql.sql")
[ "$status" != '200' ] || fail 'backend internals are publicly accessible'

commit=$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')
printf 'ok\nchecked_at=%s\ncommit=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$commit" > .timeweb-health
printf 'Timeweb health check OK (%s)\n' "$commit"
