# Tournament Voting Arena

Arsitektur yang dipakai sekarang:

- Front-end statis di Vercel
- Google login redirect via Supabase Auth
- Vote dan payment divalidasi di Vercel Functions
- Data vote, usage free vote, dan credit payment disimpan di Supabase Postgres
- QRIS dialurkan lewat Midtrans Snap
- PayPal dialurkan lewat PayPal Orders API

Catatan:

- Auth, vote, credit, dan payment sudah berbasis database.
- Daftar kategori, tim, dan generator bracket masih disimpan di file [lib/tournament-data.js](/c:/laragon/www/tournament/lib/tournament-data.js).
- Kalau nanti Anda ingin panel admin penuh, langkah berikutnya adalah memindahkan data kategori/tim/jadwal ke tabel Supabase juga.

## Flow bisnis

1. User login dengan Google.
2. Setiap match memberi 1 vote gratis per akun.
3. Kalau user ingin vote lebih dari 1 pada match yang sama, sistem akan minta payment.
4. Payment sukses akan menambah `credit`.
5. Credit dipakai otomatis saat user vote tambahan.

## Struktur penting

- `index.html`: UI utama
- `app/main.js`: front-end auth, state, vote, payment flow
- `api/`: Vercel Functions
- `lib/`: helper shared antara front-end dan server
- `supabase/schema.sql`: schema database dan RPC

## Setup lokal

1. Install dependency:

```bash
npm install
```

2. Buat project Supabase, lalu jalankan isi [supabase/schema.sql](/c:/laragon/www/tournament/supabase/schema.sql) di SQL Editor.

3. Isi `.env.local` dari template [.env.example](/c:/laragon/www/tournament/.env.example).

4. Jalankan lokal:

```bash
npx vercel dev
```

## Supabase Auth

Di dashboard Supabase:

1. Aktifkan provider Google.
2. Tambahkan redirect URL lokal:

```text
http://localhost:3000
```

3. Tambahkan redirect URL production setelah deploy, misalnya:

```text
https://nama-project-anda.vercel.app
```

## Environment Variables

Wajib:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

PayPal:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_API_BASE`
- `PAYPAL_USD_PER_CREDIT`

QRIS via Midtrans:

- `MIDTRANS_SERVER_KEY`
- `MIDTRANS_CLIENT_KEY`
- `MIDTRANS_API_BASE`
- `MIDTRANS_SNAP_API_BASE`
- `MIDTRANS_ENABLED_PAYMENTS`

Harga:

- `PRICE_PER_CREDIT_IDR`

## Deploy ke Vercel

1. Push repo ke GitHub.
2. Import project ke Vercel.
3. Isi semua environment variables yang sama seperti lokal.
4. Deploy.
5. Setelah URL production keluar, masukkan URL itu ke Supabase Auth redirect URLs, PayPal return domain, dan Midtrans callback/allowed origin bila diperlukan.

## Catatan payment

- PayPal memakai redirect checkout.
- QRIS memakai Midtrans Snap redirect.
- Webhook Midtrans masuk ke `/api/webhooks/midtrans`.
- Return PayPal masuk ke `/api/payments/paypal/return`.

## Verifikasi syntax

```bash
npm run check
```
