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
exec /bin/sh '$SITE_DIR/deploy-timeweb.sh' >> '$LOG_FILE' 2>&1
EOF
chmod 700 "$AUTO_SCRIPT"

# Run once now so we know the wrapper itself works.
/bin/sh "$AUTO_SCRIPT"

# Timeweb blocks editing crontab from SSH on virtual hosting. If a cron task
# already exists, confirm it; otherwise print the exact panel settings needed.
if crontab -l 2>/dev/null | grep -Fq 'kuzdvor-autodeploy.sh'; then
  echo "Автообновление уже включено в Crontab"
  echo "Лог: $LOG_FILE"
  exit 0
fi

cat <<EOF
Подготовка завершена, но Timeweb не разрешает создавать cron-задачи из SSH.
Добавь задачу вручную в Панели управления → Crontab:
  Название: kuzdvor-autodeploy
  Интерпретатор: Сценарий SH
  Путь до файла: /.local/bin/kuzdvor-autodeploy.sh
  Расписание: каждые 5 минут (экспертно: минуты */5, остальные поля *)
Лог обновлений: $LOG_FILE
EOF
