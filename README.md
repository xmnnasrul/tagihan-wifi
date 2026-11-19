# Tagihan WiFi

Aplikasi administrasi pelanggan WiFi untuk mengelola paket, tagihan, pembayaran, kunjungan lapangan, dan laporan operasional. Dibangun dengan Next.js, TypeScript, Tailwind CSS, dan MongoDB.

## Fitur

- Dashboard periode tagihan, pemasukan, saldo tertunggak, dan pelanggan.
- Data pelanggan, detail pelanggan, paket, serta riwayat tagihan.
- Generate Month membuat tagihan bulanan maksimal sekali per pemilik data dan periode, saat dashboard dibuka. Proses memakai waktu Jakarta mulai tanggal 1; jika tanggal 1 terlewat, proses mengejar saat dashboard dibuka berikutnya. Tagihan yang sudah ada tidak diubah.
- Pembayaran penuh dan cicilan; pembayaran tunggakan dialokasikan ke tagihan tertua.
- Pencatatan kunjungan dan rekap setoran harian.
- Catatan operasional per admin dengan checklist selesai dan penghapusan catatan.
- Laporan tunggakan yang hanya mencakup pelanggan aktif. Pelanggan arsip beserta riwayatnya tidak masuk laporan ini.
- Arsip dan pemulihan pelanggan. Penghapusan permanen turut menghapus riwayat tagihan.
- Asisten AI untuk pelanggan, tagihan/pembayaran, laporan, arsip, dan penagihan; riwayat chat bersifat privat per akun dan otomatis kedaluwarsa setelah lima hari.
- Ekspor data tagihan ke CSV, XLSX, atau TXT.
- Audit aktivitas, profil akun, pengelolaan admin, tema terang/gelap, dan tampilan responsif.

### Chat AI

- Alfii membantu obrolan umum serta pertanyaan tentang pelanggan, paket, catatan, tagihan/pembayaran, laporan, arsip, dan penagihan. Gaya jawabannya menyesuaikan konteks: pembuka dan susunan jawaban bervariasi tanpa mengulang sapaan secara otomatis.
- Riwayat tagihan pelanggan ditampilkan dalam tabel per bulan, termasuk status, jumlah dibayar, dan catatan. Rincian pembayaran mencakup tanggal, petugas, nominal, catatan, dan status.
- Tabel hasil Alfii memakai navigasi halaman dengan maksimal 20 data per halaman; nomor urut berlanjut pada halaman berikutnya.
- Admin hanya dapat memakai Chat AI setelah aksesnya diaktifkan superadmin. Pengaturan Base URL, API Key, dan model hanya dapat diubah superadmin.
- Pengaturan penyedia AI disimpan di MongoDB. API Key dienkripsi dengan AES-256-GCM di server dan tidak dikirim ke browser. Permintaan model dan chat diteruskan melalui server; hanya superadmin yang dapat mengubah pengaturan.
- Pengaturan provider dilakukan dari dialog **Pengaturan koneksi AI** pada halaman Chat AI. Untuk Cloudflare AI, masukkan Account ID, API Token dengan izin Account > Workers AI > Read, dan ID model dari katalog Cloudflare seperti `@cf/meta/llama-3.1-8b-instruct` atau model eksternal `google/gemini-4-argon`.
- Untuk pertanyaan tentang data website, server mengambil konteks relevan dari MongoDB dengan pembatasan kepemilikan akun dan izin role. Konteks yang diperlukan dikirim bersama pertanyaan ke penyedia AI; Alfii tidak terhubung langsung ke database dan tidak dapat mengubah data bisnis.
- Alfii juga dapat menjawab daftar paket beserta nama, kecepatan, harga, dan keterangan; serta catatan/checklist milik akun aktif beserta status selesai. Daftar catatan dibatasi hingga 20 catatan terbaru per permintaan. Data hanya dimuat ketika topik paket atau catatan diminta.
- Pertanyaan lanjutan seperti "berapa tagihannya?" dapat memakai pelanggan/topik dari pertanyaan sebelumnya untuk mencari konteks database. Riwayat membantu memahami rujukan, tetapi bukan sumber fakta; Alfii diminta meminta klarifikasi jika rujukannya tidak jelas.
- Jika admin memberi istilah/perintah kerja yang belum dipahami, Alfii akan meminta klarifikasi. Setelah admin menjelaskan maksudnya, Alfii otomatis memperbarui satu rangkuman memori privat per akun: satu baris ringkas per istilah, dan penjelasan terbaru menggantikan baris dengan istilah yang sama. Batas rangkuman adalah 80.000 karakter; bila penuh, memori baru tidak disimpan dan aplikasi menampilkan pesan gagal.
- Chat biasa tidak otomatis menjadi pelatihan. Memori hanya untuk arti istilah/perintah kerja yang dijelaskan admin, bukan rahasia atau fakta pelanggan/tagihan yang dapat berubah. Memori tidak menggantikan data terbaru dari website dan tidak melatih ulang model AI. Saat menjawab, Alfii hanya menyertakan maksimal empat baris memori yang relevan dengan batas gabungan sekitar 1.200 karakter untuk menghemat token.
- Akses Alfii dibatasi oleh konteks yang server pilih dan izin role: admin mendapat data akunnya, sedangkan superadmin dapat menanyakan data lintas akun sesuai izin yang berlaku. Alfii sendiri tidak memiliki akses langsung ke database atau kewenangan menulis data; perubahan bisnis tetap harus melalui API dan pemeriksaan izin. Memori tidak menambah hak akses. Pertanyaan dan konteks relevan tetap diteruskan ke penyedia AI yang dikonfigurasi.
- Konteks pelanggan yang relevan—termasuk alamat untuk hasil pencarian pelanggan tertentu—dapat diteruskan ke penyedia AI. Periksa kebijakan privasi penyedia sebelum menggunakannya.
- Riwayat chat disimpan di MongoDB, privat per akun, dan kedaluwarsa setelah lima hari. Hingga delapan pesan sebelumnya dapat dikirim ke penyedia AI sebagai konteks percakapan.

## Role

- **Admin:** mengelola data operasional milik akunnya sendiri.
- **Superadmin:** dapat mengakses data lintas admin dan mengelola akun admin.

Semua halaman aplikasi memerlukan autentikasi. Halaman Pengelolaan Admin hanya tersedia untuk superadmin. Pendaftaran publik dinonaktifkan; akun dibuat oleh superadmin atau melalui proses seed awal.

## Menjalankan Lokal

Persyaratan: Node.js 22.9 atau lebih baru (dibutuhkan oleh `--env-file-if-exists` pada `npm run migrate`), npm, dan MongoDB yang dapat diakses.

1. Salin `.env.example` menjadi `.env.local`.
2. Isi `MONGODB_URI`, `JWT_SECRET`, dan `CHAT_AI_ENCRYPTION_KEY`. Buat kunci enkripsi dengan `openssl rand -base64 32`. Jangan commit `.env.local`.
3. Instal dependency dan jalankan aplikasi:

```bash
npm ci
npm run dev
```

Buka `http://localhost:3000`.

Jika memakai database yang sudah berisi data dari versi sebelumnya, jalankan migrasi sekali:

```bash
npm run migrate
```

Skrip ini aman dijalankan berulang: mengisi `ownerId` data lama, menghapus index usang, dan memastikan index terbaru ada. Aplikasi tidak lagi menjalankan migrasi data otomatis setiap kali server dimulai.

Untuk membuat admin dan paket awal pada database kosong di mode development:

```bash
curl -X POST http://localhost:3000/api/seed
```

Akun development awal menggunakan username `admin` dengan role superadmin dan password `admin123`. Ganti password setelah masuk. Jangan gunakan password tersebut di production.

## Production

Atur `MONGODB_URI`, `JWT_SECRET`, dan `CHAT_AI_ENCRYPTION_KEY` sebagai environment variables rahasia pada platform hosting. Gunakan nilai `CHAT_AI_ENCRYPTION_KEY` yang sama pada setiap deployment. Jika kunci hilang atau berubah, API Key yang telah tersimpan tidak dapat didekripsi dan perlu dimasukkan ulang oleh superadmin. Untuk seed awal production, atur juga `SEED_SECRET` dan `INITIAL_ADMIN_PASSWORD`, lalu panggil endpoint berikut satu kali:

```bash
curl -X POST https://DOMAIN-ANDA/api/seed \
  -H "x-seed-secret: NILAI_SEED_SECRET"
```

Masuk dengan username `admin` (superadmin) dan password dari `INITIAL_ADMIN_PASSWORD`, lalu ganti password. Setelah seed berhasil, hapus `SEED_SECRET` dan `INITIAL_ADMIN_PASSWORD` dari konfigurasi hosting. Deployment perlu mendukung aplikasi Next.js dan koneksi keluar ke MongoDB Atlas.

Saat memperbarui database dari versi sebelumnya, jalankan `npm run migrate` sekali dari mesin yang memiliki akses ke `MONGODB_URI`. Index aplikasi tetap dibuat otomatis saat koneksi, tetapi migrasi data tidak lagi berjalan di setiap cold start.

Semua error API dicatat lewat `logError` di `lib/logger.ts`. Untuk mengirim error ke layanan monitoring, panggil `setErrorSink` sekali saat aplikasi start; tanpa sink, log tetap masuk ke console.

## CI

Workflow `.github/workflows/ci.yml` menjalankan `lint`, `typecheck`, `test`, dan `build` pada setiap push dan pull request. Tidak perlu konfigurasi host spesifik; aplikasi bisa dideploy ke platform apa pun yang mendukung Next.js dan Node.js 22.9+.

## Skrip

```bash
npm run dev      # server development
npm run build    # build production
npm run start    # jalankan build production
npm run lint     # ESLint
npm run typecheck # TypeScript
npm test         # node:test
npm run migrate  # migrasi data lama sekali (idempotent)
```

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Tes mencakup akses API berbasis role, pembagian kepemilikan data, keamanan header, konteks dan riwayat Chat AI, alokasi pembayaran, dan pengecualian pelanggan arsip dari laporan tunggakan.

## Keamanan

- Simpan semua credential di environment variables, bukan di source code.
- Gunakan database user khusus dengan hak minimum yang dibutuhkan.
- Batasi Network Access MongoDB Atlas ke sumber yang diperlukan.
- `JWT_SECRET` dan `SEED_SECRET` harus berbeda dan acak.
- Jalankan `npm audit --omit=dev` sebelum deploy dan tangani temuan `npm audit` pada dependency development secara berkala.
- Penghapusan permanen pelanggan tidak dapat dibatalkan dan menghapus riwayat tagihannya.
- Rate limit login mendeteksi IP klien otomatis dari header proxy umum (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, dsb). Jika deploy di belakang proxy dengan header khusus, set `CLIENT_IP_HEADER`.
- Base URL AI custom divalidasi terhadap alamat private/internal (SSRF) dan hanya menerima HTTP/HTTPS publik.
- Pencarian pelanggan/tagihan men-escape regex, sehingga input pengguna tidak bisa menyuntikkan pola regex.
