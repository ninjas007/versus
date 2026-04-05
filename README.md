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
- Daftar kategori dan tim sekarang disimpan di file JSON [data/tournaments.json](/c:/laragon/www/tournament/data/tournaments.json).
- Jadi kalau Anda ingin ganti event, cukup edit file JSON itu lalu `push`; Vercel akan auto deploy ulang.
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
- `data/tournaments.json`: source data turnamen yang bisa Anda edit manual

## Ganti data turnamen

Edit file [data/tournaments.json](/c:/laragon/www/tournament/data/tournaments.json).

Contoh dengan preset round:

```json
{
  "roundLabelPresets": {
    "16": ["Round of 16", "Quarterfinal", "Semifinal", "Final", "Champion"],
    "24": ["Play-In", "Top 16", "Quarterfinal", "Semifinal", "Final", "Champion"],
    "32": ["Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final", "Champion"]
  },
  "categories": [
    {
      "id": "my-event",
      "label": "My Event",
      "subtitle": "Vote your champion",
      "roundLabelPreset": "16",
      "schedule": {
        "startAt": "2026-05-20T19:00:00+07:00",
        "matchDurationMinutes": 25,
        "matchGapMinutes": 28,
        "roundGapMinutes": 80
      },
      "teams": [
        {
          "id": "team-a",
          "name": "Team A",
          "seed": 1,
          "image": "https://example.com/team-a.png"
        },
        {
          "id": "team-b",
          "name": "Team B",
          "seed": 2,
          "image": "https://example.com/team-b.png"
        }
      ]
    }
  ]
}
```

Aturan penting:

- `id` kategori harus unik
- `id` tim harus unik di dalam kategori
- `seed` dipakai untuk urutan bracket
- untuk gambar tim, isi `image` dengan URL gambar
- field alias seperti `imageUrl`, `avatarUrl`, atau `logoUrl` juga didukung
- `roundLabelPreset` bisa diarahkan ke preset seperti `16`, `24`, atau `32`
- kalau mau custom penuh per event, isi `roundLabels` langsung di kategori
- `schedule.startAt` adalah pilihan terbaik untuk event nyata karena timer tidak reset saat refresh
- untuk demo harian, Anda juga bisa pakai `schedule.startTime` + `timezoneOffset`
- setelah edit JSON, commit/push saja dan Vercel akan redeploy

## Setup lokal

1. Install dependency:

```bash
npm install
```

2. Buat project Supabase, lalu jalankan isi [supabase/schema.sql](/c:/laragon/www/tournament/supabase/schema.sql) di SQL Editor.

3. Isi `.env.local` dari template [.env.example](/c:/laragon/www/tournament/.env.example).

4. Jalankan lokal:

```bash
npm run dev
```

Catatan:

- `npm run dev` memakai server lokal biasa, jadi tidak perlu `vercel login`.
- Kalau Anda tetap ingin emulator resmi Vercel, pakai:

```bash
npm run dev:vercel
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
