# TBH Stash — Web Inventory & Market

Web app untuk cek inventory dan harga Steam Market Task Bar Hero dari file save `.es3`.

Terinspirasi dari [TBH Index](https://tbhindex.com/) dan logic dari [tbh-companion](https://github.com/Diysarm/TBH-rzd).

## Fitur

- Upload `SaveFile_Live.es3` — decrypt & parse **100% di browser** (file tidak dikirim ke server)
- Inventory — daftar item, filter, total nilai Steam
- Refresh harga dari Steam Community Market (manual)
- Cache harga 24 jam di localStorage browser

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:5173

API proxy Steam (`/api/steam/*`) aktif otomatis di dev dan preview.

## Deploy ke Vercel

Proyek ini sudah siap deploy dengan **Vercel Serverless Functions** + **CDN cache shared**.

### Langkah cepat

1. Push repo ke GitHub
2. Import project di [vercel.com/new](https://vercel.com/new)
3. Framework: **Vite** (auto-detect)
4. Deploy — selesai

File penting:

| File | Fungsi |
|------|--------|
| `vercel.json` | SPA routing + config functions |
| `api/steam/search.js` | Proxy katalog market bulk |
| `api/steam/priceoverview.js` | Proxy harga per item |
| `api/wiki/catalog.js` | Proxy icon wiki |
| `server/steamProxy.mjs` | Logic shared (dev + production) |

### Cache shared (mengurangi rate limit)

Tanpa setup tambahan, Vercel **CDN** cache response Steam per URL:

- `priceoverview` — 1 jam (`s-maxage=3600`)
- `search` (katalog) — 24 jam

Artinya: kalau teman A sudah fetch harga item X, teman B dapat response yang sama dari edge cache **tanpa hit Steam lagi**.

### Redis optional (lebih kuat)

Untuk cache antar-region yang lebih konsisten, tambah **Upstash Redis** dari Vercel Marketplace:

1. Vercel Dashboard → project → **Storage** → **Redis** (Upstash)
2. Connect ke project — env `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` otomatis ter-set
3. Redeploy

Response header `X-Cache: KV-HIT` = data dari Redis, bukan Steam.

### Rate limit & penggunaan

| Aksi | Hit Steam? | Shared limit? |
|------|-----------|---------------|
| Upload save | Tidak (parse lokal) | — |
| Lihat harga dari cache browser | Tidak | — |
| Pertama kali load katalog | Ya (~74 request) | Ya, CDN/Redis bantu |
| Refresh prices (semua item) | Ya (~3s/item) | Ya — gunakan jarang |

**Tips:** Teman-teman sebaiknya **tidak refresh bersamaan** untuk inventory besar. Upload save saja sudah cukup untuk harga dari katalog.

### CLI deploy

```bash
npm i -g vercel
vercel login
vercel --prod
```

## Build lokal

```bash
npm run build
npm run preview
```

## Lokasi save file (Windows)

```
%USERPROFILE%\AppData\LocalLow\TesseractStudio\TaskbarHero\SaveFile_Live.es3
```
