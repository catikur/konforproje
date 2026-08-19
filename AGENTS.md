# Agent notes

## Cursor Cloud specific instructions

### Services

| Service | Command | Port | Notes |
| --- | --- | --- | --- |
| PostgreSQL | `sudo pg_ctlcluster 16 main start` | 5432 | Cloud VM’de systemd start engelli olabilir; `pg_ctlcluster` kullan |
| API | `pnpm dev:api` (cwd repo root) | 3001 | `apps/api/.env` → `DATABASE_URL`, `JWT_SECRET` |
| Expo web | `pnpm --filter @konfor/mobile web` | 8081 | `EXPO_PUBLIC_API_URL=http://localhost:3001/api` |

### Auth seed

- Kullanıcı: `admin` / `admin123` (seed sonrası)
- Self-signup yok; kullanıcılar Admin ekranından oluşturulur

### Gotchas

- `pnpm install` sonrası native build script’leri `package.json` → `pnpm.onlyBuiltDependencies` ile onaylı (`prisma`, `argon2`, …). İnteraktif `pnpm approve-builds` kullanma.
- Shared paket önce build edilmeli: `pnpm --filter @konfor/shared build` (API `@konfor/shared` dist’e bağlı).
- Prisma client: `pnpm --filter @konfor/api prisma:generate` (migrate deploy sonrası da).
- OCR: `OPENAI_API_KEY` yoksa job `FAILED` + manuel giriş; `REDIS_URL` yoksa süreç içi kuyruk; `S3_ENDPOINT` yoksa `uploads/`.
- Standart komutlar için kök [README.md](README.md) ve [docs/URUN_PLANI.md](docs/URUN_PLANI.md).
