# WiFi Billing System

Sistem manajemen tagihan WiFi dengan Next.js, MongoDB, dan Tailwind CSS.

## Fitur

- Login admin dengan JWT authentication
- Endpoint manajemen data hanya dapat diakses admin; pendaftaran publik dinonaktifkan
- Dashboard dengan pelanggan aktif, total tagihan, pembayaran terkumpul, dan sisa belum lunas
- Tambah tagihan bulanan dengan status TF, Cash, atau Nyicil
- Field cicilan otomatis muncul saat status "Nyicil"
- Manajemen paket internet (CRUD)
- Riwayat tagihan per pelanggan
- Ekspor rekonsiliasi CSV/Excel dengan rincian pembayaran dan sisa saldo (filter per bulan/tahun)
- Log audit untuk perubahan tagihan, pelanggan, paket, dan akun admin
- Pengelolaan admin: tambah akun, aktifkan/nonaktifkan, serta perlindungan agar selalu ada admin aktif
- Tema gelap minimalis

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup MongoDB Atlas

1. Buka [MongoDB Atlas](https://www.mongodb.com/atlas) dan daftar akun gratis
2. Buat cluster baru (pilih tier gratis M0)
3. Klik **Connect** pada cluster, pilih **Drivers**
4. Salin **Connection String** (format: `mongodb+srv://<username>:<password>@cluster...`)
5. Ganti `<password>` dengan password database user Anda
6. Buat file `.env.local` di root project:

```
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/wifi_billing?retryWrites=true&w=majority
JWT_SECRET=secret-acak-minimal-32-karakter
```

### 3. Seed Database (Buat Akun Admin & Paket Default)

Di lingkungan lokal, setelah menjalankan aplikasi, jalankan:

```bash
curl -X POST http://localhost:3000/api/seed
```

Ini akan membuat:
- Akun admin: username `admin`, password `admin123`
- 4 paket default (10Mbps, 20Mbps, 50Mbps, 100Mbps)

### 4. Jalankan Aplikasi

```bash
npm run dev
```

Buka `http://localhost:3000` dan login dengan admin / admin123.

## Deploy ke Vercel

1. Push project ke GitHub
2. Buka [vercel.com](https://vercel.com) dan login dengan GitHub
3. Klik **Add New Project** dan pilih repository Anda
4. Di bagian **Environment Variables**, tambahkan:
   - `MONGODB_URI` = connection string MongoDB Atlas Anda
   - `JWT_SECRET` = secret key acak Anda
5. Klik **Deploy**
6. Tunggu proses build selesai, lalu buka URL Vercel
7. Untuk inisialisasi production, atur `SEED_SECRET` dan `INITIAL_ADMIN_PASSWORD` sebagai environment variable, lalu panggil endpoint seed satu kali menggunakan `POST` dan header `x-seed-secret`. Endpoint seed menolak request production tanpa secret tersebut. Setelah inisialisasi, hapus `SEED_SECRET` dan `INITIAL_ADMIN_PASSWORD` dari environment.

## Struktur Folder

```
├── app/
│   ├── (app)/                 # Halaman dengan auth (dashboard, billing, packages, customers)
│   │   ├── dashboard/
│   │   ├── billing/add/
│   │   ├── packages/
│   │   └── customers/[id]/
│   ├── api/
│   │   ├── auth/              # login, logout, me
│   │   ├── billings/          # CRUD tagihan + export CSV
│   │   ├── customers/        # CRUD pelanggan
│   │   ├── packages/         # CRUD paket
│   │   ├── stats/             # statistik dashboard
│   │   └── seed/              # inisialisasi data
│   ├── login/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                   # shadcn/ui components
│   └── NavSidebar.tsx
├── lib/
│   ├── models/               # Mongoose schemas (User, Package, Customer, Billing)
│   ├── auth.ts               # JWT sign/verify
│   ├── session.ts            # Server-side session helper
│   ├── mongodb.ts            # MongoDB connection
│   └── utils.ts
├── middleware.ts             # Route protection
└── .env.local
```
