# Konfor Proje

İç kullanım gelir–gider, backlog ve dashboard sistemi (web + mobil).

## Stack

- **Monorepo:** pnpm + Turborepo
- **API:** NestJS + Prisma + PostgreSQL (`apps/api`)
- **İstemci:** Expo Router — iOS / Android / Web (`apps/mobile`)
- **Paylaşılan:** Zod + KDV hesapları (`packages/shared`)

## Kurulum

```bash
# PostgreSQL çalışıyor olmalı; örnek URL:
# postgresql://konfor:konfor@localhost:5432/konforproje

cp apps/api/.env.example apps/api/.env   # gerekirse düzenle
pnpm install
pnpm --filter @konfor/shared build
pnpm --filter @konfor/api prisma:generate
pnpm --filter @konfor/api prisma:migrate
pnpm --filter @konfor/api prisma:seed
```

Seed kullanıcı: `admin` / `admin123`

## Geliştirme

```bash
# Terminal 1 — API (port 3001)
pnpm dev:api

# Terminal 2 — Expo web/mobil (port 8081)
pnpm --filter @konfor/mobile web
# veya: pnpm --filter @konfor/mobile start
```

`EXPO_PUBLIC_API_URL` varsayılanı: `http://localhost:3001/api`

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `pnpm lint` | Tip kontrolü |
| `pnpm test` | Unit testler (shared + api) |
| `pnpm db:seed` | Seed |

Ürün planı: [docs/URUN_PLANI.md](docs/URUN_PLANI.md)
