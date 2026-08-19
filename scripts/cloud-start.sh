#!/usr/bin/env bash
# Cloud Agent start: Postgres, .env, migrate/seed. API ve Expo terminals'ta açılır.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_ENV="$ROOT/apps/api/.env"

pg_ver="$(ls /usr/lib/postgresql 2>/dev/null | sort -V | tail -1 || true)"
if [[ -n "$pg_ver" ]] && command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo pg_ctlcluster "$pg_ver" main start || true
else
  sudo service postgresql start || true
fi

for _ in $(seq 1 40); do
  if sudo -u postgres pg_isready -q; then
    break
  fi
  sleep 0.5
done
sudo -u postgres pg_isready -q

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='konfor'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER konfor WITH PASSWORD 'konfor' SUPERUSER;"
else
  sudo -u postgres psql -c "ALTER USER konfor WITH PASSWORD 'konfor' SUPERUSER;" >/dev/null
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='konforproje'" | grep -q 1; then
  sudo -u postgres createdb -O konfor konforproje
fi

jwt="${JWT_SECRET:-}"
if [[ -z "$jwt" && -f "$API_ENV" ]]; then
  jwt="$(grep -E '^JWT_SECRET=' "$API_ENV" | cut -d= -f2- | tr -d '"' || true)"
fi
if [[ -z "$jwt" || "$jwt" == "change-me-in-production" ]]; then
  jwt="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
fi

export KONFOR_JWT="$jwt"
export KONFOR_OR_KEY="${OPENROUTER_API_KEY:-}"
export KONFOR_API_ENV="$API_ENV"
python3 - <<'PY'
import os
from pathlib import Path
p = Path(os.environ["KONFOR_API_ENV"])
jwt = os.environ["KONFOR_JWT"]
or_key = os.environ.get("KONFOR_OR_KEY") or ""
lines = [
    'DATABASE_URL="postgresql://konfor:konfor@127.0.0.1:5432/konforproje?schema=public"',
    f'JWT_SECRET="{jwt}"',
    "PORT=3001",
    "UPLOAD_DIR=uploads",
    'CORS_ORIGIN="http://localhost:8081,http://127.0.0.1:8081"',
    "NODE_ENV=development",
    'OCR_BASE_URL="https://openrouter.ai/api/v1"',
    'OCR_MODEL="x-ai/grok-4.6"',
]
if or_key:
    lines.append(f'OPENROUTER_API_KEY="{or_key}"')
p.write_text("\n".join(lines) + "\n")
PY

# Prisma CLI .env yükler; `tsx prisma/seed.ts` yüklemez.
cd "$ROOT/apps/api"
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
