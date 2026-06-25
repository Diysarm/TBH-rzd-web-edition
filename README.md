# TBH Stash — Web Inventory & Market

Web app untuk cek inventory dan harga Steam Market Task Bar Hero dari file save `.es3`.

Terinspirasi dari [TBH Index](https://tbhindex.com/) dan logic dari [tbh-companion](https://github.com/Diysarm/TBH-rzd).

## Fitur

- Upload `SaveFile_Live.es3` — decrypt & parse **100% di browser** (file tidak dikirim ke server)
- Tab **Inventory** — daftar item, filter, total nilai Steam
- Tab **Market** — pilih currency, refresh harga dari Steam Community Market
- Cache harga 24 jam di localStorage

## Jalankan

```bash
npm install
npm run dev
```

Buka http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

Proxy Steam (`/api/steam/priceoverview`) aktif di dev dan preview. Untuk deploy production, sediakan endpoint proxy yang sama (Vercel/Netlify function) karena browser tidak bisa langsung fetch Steam (CORS).

## Lokasi save file (Windows)

```
%USERPROFILE%\AppData\LocalLow\TesseractStudio\TaskbarHero\SaveFile_Live.es3
```
