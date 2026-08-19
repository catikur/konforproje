#!/usr/bin/env bash
# Günlük Postgres yedeği. Crontab örneği: 0 2 * * * /path/to/scripts/backup-db.sh
set -euo pipefail
URL="${DATABASE_URL:-postgresql://konfor:konfor@localhost:5432/konforproje}"
DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$DIR"
FILE="$DIR/konfor-$(date +%Y%m%d-%H%M).sql.gz"
pg_dump "$URL" | gzip > "$FILE"
# 14 günden eski yedekleri sil
find "$DIR" -name 'konfor-*.sql.gz' -mtime +14 -delete
echo "Yedek: $FILE"
