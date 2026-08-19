#!/usr/bin/env bash
# Cloud Agent install: bağımlılıklar + Prisma client. Postgres süreci install'da açılmaz.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-contrib
fi

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm --filter @konfor/shared build
pnpm --filter @konfor/api prisma:generate
