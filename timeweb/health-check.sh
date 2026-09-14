#!/bin/sh
set -eu

BASE_URL="https://kuzdvor.tw1.ru"
TMP_DIR="${TMPDIR:-/tmp}/kuzdvor-timeweb-health-$$"
STATUS_FILE="$(pwd)/deployment-health-status.txt"
HEALTH_STAGE="startup"
HEALTH_OK=0
TARGET_SOURCE_SHA="unknown"
mkdir -p "$TMP_DIR"

if [ -f deployment-version.json ]; then
  TARGET_SOURCE_SHA=$(sed -n 's/.*"sourceSha"[[:space:]]*:[[:space:]]*"\([0-9a-fA-F]\{40\}\)".*/\1/p' deployment-version.json | head -n 1)
  [ -n "$TARGET_SOURCE_SHA" ] || TARGET_SOURCE_SHA="unknown"
fi

write_status() {
  status="$1"
  stage="$2"
  printf 'status=%s\ntarget_source_sha=%s\nstage=%s\nchecked_at=%s\n' \
    "$status" "$TARGET_SOURCE_SHA" "$stage" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$STATUS_FILE"
}

cleanup() {
  rc=$?
  rm -rf "$TMP_DIR"
  if [ "$HEALTH_OK" = '1' ]; then
    write_status ok complete
  elif [ "$rc" -ne 0 ]; then
    write_status failed "$HEALTH_STAGE"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fail() {
  echo "HEALTHCHECK FAIL [$HEALTH_STAGE]: $*" >&2
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

write_status checking "$HEALTH_STAGE"

# Main page and critical static assets. The query string prevents a stale proxy
# response from making a freshly deployed package look unhealthy.
HEALTH_STAGE="public-home"
curl --fail --silent --show-error --location --max-time 25 -D "$TMP_DIR/index.headers" "$BASE_URL/?deploy_health=$TARGET_SOURCE_SHA" -o "$TMP_DIR/index.html"
grep -q 'Кузнечный Дворик' "$TMP_DIR/index.html" || fail 'main page marker missing'
grep -q 'site.bundle.js' "$TMP_DIR/index.html" || fail 'site.bundle.js reference missing'
grep -q 'site.css' "$TMP_DIR/index.html" || fail 'site.css reference missing'
grep -q 'content="index,follow,max-image-preview:large"' "$TMP_DIR/index.html" || fail 'main page is not indexable'
grep -q '<link rel="canonical" href="https://kuzdvor.tw1.ru/">' "$TMP_DIR/index.html" || fail 'main page canonical is invalid'
grep -q '<meta property="og:url" content="https://kuzdvor.tw1.ru/">' "$TMP_DIR/index.html" || fail 'main page og:url is invalid'
grep -q 'type="application/ld+json"' "$TMP_DIR/index.html" || fail 'LocalBusiness JSON-LD script missing'
grep -q '"@type":"LocalBusiness"' "$TMP_DIR/index.html" || fail 'LocalBusiness schema type missing'
grep -q '"@id":"https://kuzdvor.tw1.ru/#business"' "$TMP_DIR/index.html" || fail 'LocalBusiness schema id missing'
grep -q '"telephone":"+79373296750"' "$TMP_DIR/index.html" || fail 'LocalBusiness telephone missing'
grep -q '"addressLocality":"Мелеуз"' "$TMP_DIR/index.html" || fail 'LocalBusiness locality missing'
if grep -Eiq '^X-Robots-Tag:.*(noindex|nofollow|noarchive)' "$TMP_DIR/index.headers"; then
  fail 'main page is blocked by X-Robots-Tag'
fi
if grep -qi 'noindex' "$TMP_DIR/index.html"; then
  fail 'main page is accidentally noindexed'
fi
if grep -qi 'workers\.dev' "$TMP_DIR/index.html"; then
  fail 'main page still references Cloudflare Workers'
fi

HEALTH_STAGE="canonical-redirect"
curl --silent --show-error --max-time 25 -D "$TMP_DIR/vorota-redirect.headers" -o /dev/null "$BASE_URL/vorota?deploy_health=$TARGET_SOURCE_SHA"
vorota_status=$(awk 'NR==1{print $2}' "$TMP_DIR/vorota-redirect.headers")
vorota_location=$(awk 'BEGIN{IGNORECASE=1} /^location:/{sub(/\r$/,"",$2); print $2; exit}' "$TMP_DIR/vorota-redirect.headers")
case "$vorota_status" in 301|308) ;; *) fail "/vorota must permanently redirect, got HTTP ${vorota_status:-missing}" ;; esac
case "$vorota_location" in https://kuzdvor.tw1.ru/*|/*) ;; *) fail "unexpected /vorota redirect target: ${vorota_location:-missing}" ;; esac

HEALTH_STAGE="seo-files"
fetch "$BASE_URL/robots.txt?deploy_health=$TARGET_SOURCE_SHA" "$TMP_DIR/robots.txt"
grep -q '^User-agent: \*$' "$TMP_DIR/robots.txt" || fail 'robots.txt is invalid'
grep -q '^Allow: /$' "$TMP_DIR/robots.txt" || fail 'robots.txt does not allow the public site'
grep -q '^Disallow: /admin$' "$TMP_DIR/robots.txt" || fail 'robots.txt does not protect admin crawling'
grep -q '^Sitemap: https://kuzdvor.tw1.ru/sitemap.xml$' "$TMP_DIR/robots.txt" || fail 'robots.txt sitemap URL is invalid'
fetch "$BASE_URL/sitemap.xml?deploy_health=$TARGET_SOURCE_SHA" "$TMP_DIR/sitemap.xml"
grep -q '<loc>https://kuzdvor.tw1.ru/</loc>' "$TMP_DIR/sitemap.xml" || fail 'sitemap is missing the main page'
grep -q '<loc>https://kuzdvor.tw1.ru/napravleniya</loc>' "$TMP_DIR/sitemap.xml" || fail 'sitemap is missing the directions page'

HEALTH_STAGE="static-assets"
fetch "$BASE_URL/site.css?deploy_health=$TARGET_SOURCE_SHA" "$TMP_DIR/site.css"
fetch "$BASE_URL/site.bundle.js?deploy_health=$TARGET_SOURCE_SHA" "$TMP_DIR/site.bundle.js"
fetch "$BASE_URL/admin?deploy_health=$TARGET_SOURCE_SHA" "$TMP_DIR/admin.html"
grep -q 'Админ-панель' "$TMP_DIR/admin.html" || fail 'admin page marker missing'
grep -q 'noindex,nofollow,noarchive' "$TMP_DIR/admin.html" || fail 'admin page must be noindexed'
grep -q '<script src="/xlsx.bundle.js"></script>' "$TMP_DIR/admin.html" || fail 'external XLSX bundle reference missing from admin page'
if grep -q 'unsupported format' "$TMP_DIR/admin.html"; then
  fail 'XLSX source leaked into visible admin HTML'
fi
fetch "$BASE_URL/xlsx.bundle.js?deploy_health=$TARGET_SOURCE_SHA" "$TMP_DIR/xlsx.bundle.js"
grep -q 'xlsx.js' "$TMP_DIR/xlsx.bundle.js" || fail 'XLSX bundle invalid'
fetch "$BASE_URL/napravleniya?deploy_health=$TARGET_SOURCE_SHA" "$TMP_DIR/napravleniya.html"
if grep -qi 'noindex' "$TMP_DIR/napravleniya.html"; then
  fail 'directions page is accidentally noindexed'
fi
if grep -qi 'workers\.dev' "$TMP_DIR/napravleniya.html"; then
  fail 'directions page still references Cloudflare Workers'
fi

HEALTH_STAGE="php-mysql"
fetch_local_api "$BASE_URL/api/health?deploy_health=$TARGET_SOURCE_SHA" "$TMP_DIR/health.json" "$TMP_DIR/health.headers"
grep -q '"backend":"timeweb-php"' "$TMP_DIR/health.json" || fail 'local PHP backend health marker missing'
grep -q '"configured":true' "$TMP_DIR/health.json" || fail 'local backend is not configured'
grep -q '"db":true' "$TMP_DIR/health.json" || fail 'local MySQL connection failed'
grep -q '"ok":true' "$TMP_DIR/health.json" || fail 'local backend health is not OK'

HEALTH_STAGE="pricing-engine"
quote_check=$(php -r '
require __DIR__ . "/backend/bootstrap.php";
require __DIR__ . "/backend/excel-quote-validation.php";
$defaults = kd_defaults();
$base = kd_gate_calculate_product("6", 3.4, 1.8, 1.0, 1.8, $defaults["gateCalcPrices"] ?? []);
if ($base !== 56600) { fwrite(STDERR, "default Art.6=".$base); exit(11); }
$runtime = kd_gate_calculate_product("6", 3.4, 1.8, 1.0, 1.8, kd_gate_runtime_price_inputs());
if ($runtime < 10000 || $runtime > 1000000) { fwrite(STDERR, "runtime Art.6=".$runtime); exit(12); }
$standards = kd_gate_standard_prices(kd_gate_runtime_price_inputs());
if (count($standards) !== 38 || !isset($standards["6"])) { fwrite(STDERR, "standard model set incomplete"); exit(13); }
echo "default=".$base." runtime=".$runtime." models=".count($standards);
' 2>&1) || fail "PHP gate quote engine failed: $quote_check"
printf 'Pricing engine OK (%s)\n' "$quote_check"

HEALTH_STAGE="catalog-api"
fetch_local_api "$BASE_URL/api/catalog-images?deploy_health=$TARGET_SOURCE_SHA" "$TMP_DIR/catalog.json" "$TMP_DIR/catalog.headers"
grep -q '"galleries"' "$TMP_DIR/catalog.json" || fail 'catalog API response invalid'

HEALTH_STAGE="delivery-api"
curl --fail --silent --show-error --location --max-time 35 -D "$TMP_DIR/delivery.headers" \
  --get --data-urlencode 'place=Стерлитамак' --data-urlencode "deploy_health=$TARGET_SOURCE_SHA" \
  "$BASE_URL/api/delivery" -o "$TMP_DIR/delivery.json"
grep -qi '^X-Kuzdvor-Backend: timeweb-php' "$TMP_DIR/delivery.headers" || fail 'delivery is not served by Timeweb PHP'
grep -q '"distanceKm"' "$TMP_DIR/delivery.json" || fail 'delivery API response invalid'

HEALTH_STAGE="admin-auth"
status=$(curl --silent --show-error --location --max-time 25 -D "$TMP_DIR/admin-api.headers" \
  --output "$TMP_DIR/admin-api.json" --write-out '%{http_code}' \
  "$BASE_URL/api/admin/site-settings?deploy_health=$TARGET_SOURCE_SHA")
[ "$status" = '401' ] || fail "admin API should require auth, got HTTP $status"
grep -qi '^X-Kuzdvor-Backend: timeweb-php' "$TMP_DIR/admin-api.headers" || fail 'admin API is not served by Timeweb PHP'

HEALTH_STAGE="legacy-lockdown"
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

HEALTH_STAGE="private-files"
status=$(curl --silent --show-error --max-time 25 --output /dev/null --write-out '%{http_code}' "$BASE_URL/.git/config")
[ "$status" != '200' ] || fail '.git/config is publicly accessible'
status=$(curl --silent --show-error --max-time 25 --output /dev/null --write-out '%{http_code}' "$BASE_URL/backend/schema.mysql.sql")
[ "$status" != '200' ] || fail 'backend internals are publicly accessible'

commit=$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')
printf 'ok\nchecked_at=%s\ncommit=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$commit" > .timeweb-health
HEALTH_OK=1
printf 'Timeweb health check OK (%s)\n' "$commit"
