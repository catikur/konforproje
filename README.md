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

cp apps/api/.env.example apps/api/.env   # JWT_SECRET zorunlu
pnpm install
pnpm --filter @konfor/shared build
pnpm --filter @konfor/api prisma:generate
pnpm --filter @konfor/api prisma:migrate
pnpm --filter @konfor/api prisma:seed
```

Seed kullanıcı: `admin` / `admin123`

Opsiyonel (OCR / kuyruk / nesne depolama):

```bash
# REDIS_URL, OPENAI_API_KEY, S3_ENDPOINT  →  apps/api/.env
```

Yoksa: OCR süreç içi çalışır (anahtar yoksa kullanıcı manuel doldurur), dosyalar `uploads/`, kuyruk `setImmediate`.

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
| `scripts/backup-db.sh` | Postgres dump (`BACKUP_DIR`, `DATABASE_URL`) |

## Kapsam (Faz 1–4)

- JWT access (15 dk) + refresh token rotasyonu, login rate-limit
- Gelir / gider / backlog CRUD, soft delete, audit
- Dönem raporu (SQL aggregate), kategori/tedarikçi/şantiye kırılımı, Excel + PDF
- Dashboard KPI + 12 aylık trend, bütçe uyarısı, onay bekleyenler
- Gider ekleri (PDF/görsel) — kimlik doğrulamalı indirme; S3 veya yerel `uploads/`
- OCR (OpenAI Vision, opsiyonel Redis/BullMQ); öneri kullanıcı onayıyla uygulanır
- Fatura no tekilliği, şantiye/proje, onay limiti, bildirimler
- Hakediş/sözleşme, nakit akışı, tedarikçi yaşlandırma
- Banka/kasa, çek/senet, tekrarlayan gider, Excel içe aktarma
- Çoklu para (EUR/USD + kur → raporlar TRY)
- Mobil çevrimdışı gider taslağı + hızlı fiş (kamera/galeri)

Ürün planı: [docs/URUN_PLANI.md](docs/URUN_PLANI.md)
