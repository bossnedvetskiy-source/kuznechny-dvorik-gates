#!/bin/sh
set -eu

PATH=/usr/local/bin:/usr/bin:/bin
export PATH

SITE_DIR=$(pwd)
[ -d "$SITE_DIR/.git" ] || {
  echo "Запусти установщик из корня public_html репозитория" >&2
  exit 1
}
[ -f "$SITE_DIR/deploy-timeweb.sh" ] || {
  echo "Файл deploy-timeweb.sh не найден" >&2
  exit 1
}

BIN_DIR="$HOME/.local/bin"
AUTO_SCRIPT="$BIN_DIR/kuzdvor-autodeploy.sh"
LOG_FILE="$HOME/kuzdvor-autodeploy.log"
mkdir -p "$BIN_DIR"

cat > "$AUTO_SCRIPT" <<EOF
#!/bin/sh
set -eu
export KUZDVOR_SITE_DIR='$SITE_DIR'
exec /bin/sh '$SITE_DIR/deploy-timeweb.sh'
EOF
chmod 700 "$AUTO_SCRIPT"

CRON_LINE="*/5 * * * * /bin/sh '$AUTO_SCRIPT' >> '$LOG_FILE' 2>&1"
TMP_CRON="${TMPDIR:-/tmp}/kuzdvor-cron-$$"
(
  crontab -l 2>/dev/null | grep -v 'kuzdvor-autodeploy.sh' || true
  printf '%s\n' "$CRON_LINE"
) > "$TMP_CRON"
crontab "$TMP_CRON"
rm -f "$TMP_CRON"

/bin/sh "$AUTO_SCRIPT"

echo "Автообновление включено: проверка GitHub каждые 5 минут"
echo "Лог: $LOG_FILE"
echo "Команда проверки: crontab -l | grep kuzdvor-autodeploy"
