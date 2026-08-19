#!/usr/bin/env bash
# Cloud Agent install: bağımlılıklar + Prisma client. Postgres süreci install'da açılmaz.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

APT_OPTS=(-o Acquire::Retries=8 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30)
if ! command -v psql >/dev/null 2>&1; then
  ok=0
  for i in 1 2 3 4 5; do
    sudo apt-get clean >/dev/null 2>&1 || true
    if sudo apt-get "${APT_OPTS[@]}" update \
      && sudo DEBIAN_FRONTEND=noninteractive apt-get "${APT_OPTS[@]}" install -y --fix-missing postgresql postgresql-contrib; then
      ok=1
      break
    fi
    sleep $((i * 8))
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
