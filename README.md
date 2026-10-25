# Tagihan WiFi

Aplikasi administrasi pelanggan WiFi untuk mengelola paket, tagihan, pembayaran, kunjungan lapangan, dan laporan operasional. Dibangun dengan Next.js, TypeScript, Tailwind CSS, dan MongoDB.

## Fitur

- Dashboard periode tagihan, pemasukan, saldo tertunggak, dan pelanggan.
- Data pelanggan, detail pelanggan, paket, serta riwayat tagihan.
- Tagihan bulanan otomatis untuk pelanggan aktif, mulai tanggal 15 waktu Jakarta.
- Pembayaran penuh dan cicilan; pembayaran tunggakan dialokasikan ke tagihan tertua.
- Pencatatan kunjungan dan rekap setoran harian.
- Laporan tunggakan yang hanya mencakup pelanggan aktif. Pelanggan arsip beserta riwayatnya tidak masuk laporan ini.
- Arsip dan pemulihan pelanggan. Penghapusan permanen turut menghapus riwayat tagihan.
- Ekspor data tagihan ke CSV, XLSX, atau TXT.
- Audit aktivitas, profil akun, pengelolaan admin, tema terang/gelap, dan tampilan responsif.

Chat admin tidak tersedia.

## Role

- **Admin:** mengelola data operasional milik akunnya sendiri.
- **Superadmin:** dapat mengakses data lintas admin dan mengelola akun admin.

Semua halaman aplikasi memerlukan autentikasi. Halaman Pengelolaan Admin hanya tersedia untuk superadmin. Pendaftaran publik dinonaktifkan; akun dibuat oleh superadmin atau melalui proses seed awal.

## Menjalankan Lokal

Persyaratan: Node.js 20 atau lebih baru, npm, dan MongoDB yang dapat diakses.

1. Salin `.env.example` menjadi `.env.local`.
2. Isi `MONGODB_URI` dengan URI database dan `JWT_SECRET` dengan nilai acak yang panjang. Jangan commit `.env.local`.
3. Instal dependency dan jalankan aplikasi:

```bash
npm ci
npm run dev
```

Buka `http://localhost:3000`.

Untuk membuat admin dan paket awal pada database kosong di mode development:

```bash
curl -X POST http://localhost:3000/api/seed
```

Akun development awal menggunakan username `admin` dan password `admin123`. Ganti password setelah masuk. Jangan gunakan password tersebut di production.

## Production

Atur `MONGODB_URI` dan `JWT_SECRET` sebagai environment variables rahasia pada platform hosting. Untuk seed awal production, atur juga `SEED_SECRET` dan `INITIAL_ADMIN_PASSWORD`, lalu panggil endpoint berikut satu kali:

```bash
curl -X POST https://DOMAIN-ANDA/api/seed \
  -H "x-seed-secret: NILAI_SEED_SECRET"
```

Masuk dengan username `admin` dan password dari `INITIAL_ADMIN_PASSWORD`, lalu ganti password. Setelah seed berhasil, hapus `SEED_SECRET` dan `INITIAL_ADMIN_PASSWORD` dari konfigurasi hosting. Deployment perlu mendukung aplikasi Next.js dan koneksi keluar ke MongoDB Atlas.

## Pemeriksaan

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tes mencakup akses API berbasis role, pembagian kepemilikan data, keamanan header, alokasi pembayaran, dan pengecualian pelanggan arsip dari laporan tunggakan.

## Keamanan

- Simpan semua credential di environment variables, bukan di source code.
- Gunakan database user khusus dengan hak minimum yang dibutuhkan.
- Batasi Network Access MongoDB Atlas ke sumber yang diperlukan.
- `JWT_SECRET` dan `SEED_SECRET` harus berbeda dan acak.
- Penghapusan permanen pelanggan tidak dapat dibatalkan dan menghapus riwayat tagihannya.
