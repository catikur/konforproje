#!/usr/bin/env bash
# Cloud Agent install: bağımlılıklar + Prisma client. Postgres süreci install'da açılmaz.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if ! command -v psql >/dev/null 2>&1; then
  ok=0
  for i in 1 2 3 4; do
    if sudo apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib; then
      ok=1
      break
    fi
    sleep $((i * 4))
  done
  if [[ "$ok" -ne 1 ]]; then
    echo "PostgreSQL kurulamadı" >&2
    exit 1
  fi
fi

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm --filter @konfor/shared build
pnpm --filter @konfor/api prisma:generate
