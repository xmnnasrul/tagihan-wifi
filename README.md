# WiFi Billing System

Sistem manajemen tagihan WiFi dengan Next.js, MongoDB, dan Tailwind CSS.

## Fitur

- Login dengan JWT authentication
- Dashboard dengan statistik, pencarian, dan sortir pelanggan
- Tambah tagihan bulanan dengan status TF, Cash, atau Nyicil
- Field cicilan otomatis muncul saat status "Nyicil"
- Manajemen paket internet (CRUD)
- Riwayat tagihan per pelanggan
- Ekspor data tagihan ke CSV (filter per bulan/tahun)
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
JWT_SECRET=secret-key-anda-yang-acak
```

### 3. Seed Database (Buat Akun Admin & Paket Default)

Setelah menjalankan aplikasi, buka URL berikut di browser:

```
http://localhost:3000/api/seed
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
7. Kunjungi `https://nama-project.vercel.app/api/seed` untuk inisialisasi data

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
