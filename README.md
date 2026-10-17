# WiFi Billing

Aplikasi web untuk mengelola pelanggan internet WiFi, paket, tagihan bulanan, pembayaran, kunjungan collector, dan laporan operasional.

Panduan ini ditujukan untuk pemilik aplikasi atau operator yang belum terbiasa dengan coding. Beberapa tahap tetap memerlukan akun GitHub, MongoDB Atlas, dan akun layanan hosting.

## Daftar Isi

- [Fitur](#fitur)
- [Yang Perlu Disiapkan](#yang-perlu-disiapkan)
- [Menyiapkan MongoDB Atlas](#menyiapkan-mongodb-atlas)
- [Menjalankan di Komputer Sendiri](#menjalankan-di-komputer-sendiri)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Deploy Socket.IO Terpisah](#deploy-socketio-terpisah)
- [Alternatif Deploy](#alternatif-deploy)
- [Membuat Akun Admin Pertama](#membuat-akun-admin-pertama)
- [Keamanan](#keamanan)
- [Solusi Masalah Umum](#solusi-masalah-umum)

## Fitur

- **Dashboard:** ringkasan pelanggan, tagihan, uang terkumpul, tunggakan, dan progres pembayaran berdasarkan bulan dan tahun.
- **Data pelanggan:** melihat, mencari, dan membuka detail pelanggan, paket yang digunakan, serta riwayat tagihan.
- **Paket internet:** mengelola nama paket, kecepatan, harga, dan deskripsi.
- **Tagihan bulanan:** membuat tagihan untuk pelanggan aktif dan mencatat pembayaran penuh maupun cicilan.
- **Alokasi tunggakan:** pembayaran dialokasikan ke tagihan tertua terlebih dahulu. Riwayat penerimaan uang dan alokasi ke tagihan disimpan terpisah.
- **Operasional collector:** mencari pelanggan berdasarkan nama/alamat, menandai kunjungan, mencatat pembayaran, dan melihat rekap setoran harian.
- **Laporan tunggakan:** melihat saldo tagihan per pelanggan dan periode.
- **Arsip pelanggan:** mengarsipkan dan memulihkan pelanggan. Penghapusan permanen juga menghapus riwayat tagihannya dan tidak dapat dibatalkan.
- **Ekspor:** mengunduh data tagihan sebagai CSV atau Excel.
- **Chat admin:** percakapan satu lawan satu antar-admin dengan enkripsi end-to-end untuk pesan, balasan, dan media. Kunci privat disimpan di browser; setiap admin perlu membuka halaman chat untuk pertama kali dari browser yang akan dipakai. Pesan dan media dihapus otomatis setelah 15 hari.
- **Audit:** melihat catatan perubahan data dan akun.
- **Pengelolaan akun:** admin dapat membuat akun dan mengatur role.
- **Profil dan tema:** halaman profil mengelola username dan password sesuai role; tema dapat mengikuti jadwal waktu Jakarta atau dipilih manual.
- **Header keamanan:** CSP berbasis nonce, proteksi framing dan MIME sniffing, kebijakan referrer/permissions, serta HSTS di production.
- **Tes keamanan API:** kontrak tes memeriksa guard setiap handler, pengecualian endpoint publik, dan akses berdasarkan role.

### Role Akun

- **Admin:** mengelola pelanggan, paket, tagihan, akun, dan audit.
- **Collector:** menandai kunjungan dan mencatat pembayaran/setoran.
- **User:** melihat data tanpa melakukan perubahan.

Akun dapat memiliki lebih dari satu role, misalnya Admin sekaligus Collector. Pendaftaran akun publik tidak tersedia; akun dibuat oleh admin.

### Aturan Tagihan

- Satu pelanggan hanya memiliki satu tagihan untuk setiap bulan dan tahun.
- Setiap tagihan bulanan menyimpan harga paket pada saat tagihan dibuat. Mengubah harga paket tidak mengubah tagihan lama.
- Pembayaran tunggakan dialokasikan ke bulan tertua yang masih memiliki saldo.
- Tagihan otomatis tersedia mulai tanggal 15 waktu Jakarta, untuk periode Oktober 2026 dan setelahnya. Admin dapat memicu pengecekan ini dengan membuka dashboard.

## Yang Perlu Disiapkan

1. Akun GitHub yang dapat mengakses repository aplikasi.
2. Akun MongoDB Atlas untuk menyimpan data.
3. Akun layanan hosting, misalnya Vercel, Netlify, atau Render.
4. Node.js versi 20 atau lebih baru jika ingin menjalankan aplikasi di komputer sendiri.

Jangan mengirimkan password database atau secret melalui chat, email publik, screenshot, atau file yang dimasukkan ke GitHub.

## Menyiapkan MongoDB Atlas

MongoDB Atlas menyediakan database MongoDB yang berjalan di internet. Istilahnya mungkin sedikit berbeda jika tampilan Atlas berubah, tetapi langkahnya tetap sama.

### 1. Buat project dan database

1. Masuk atau buat akun di [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Buat **Project** baru, misalnya `WiFi Billing`.
3. Buat cluster/database deployment. Untuk uji coba, tier gratis Atlas dapat digunakan jika masih tersedia di region yang dipilih.
4. Pilih region yang dekat dengan pengguna atau server hosting agar koneksi lebih cepat.

### 2. Buat pengguna database

1. Buka menu **Security → Database Access**.
2. Pilih **Add New Database User**.
3. Buat username dan password yang kuat. Simpan password di password manager.
4. Beri user role baca/tulis hanya pada database aplikasi, jika pilihan tersebut tersedia. Jangan memakai akun pemilik Atlas sebagai akun aplikasi.

Password database yang mengandung karakter khusus seperti `@`, `:`, `/`, `?`, `#`, atau `%` perlu di-URL-encode saat dimasukkan ke connection string. Cara termudah adalah membuat password database yang kuat tanpa karakter tersebut, atau gunakan encoder URL tepercaya secara lokal.

### 3. Izinkan server mengakses database

1. Buka **Security → Network Access**.
2. Untuk percobaan dari komputer sendiri, tambahkan alamat IP komputer Anda.
3. Untuk hosting serverless seperti Vercel atau Netlify, alamat IP server dapat berubah. Pilihan yang mudah adalah mengizinkan `0.0.0.0/0` (akses dari internet), tetapi ini memperluas permukaan akses. Gunakan hanya bersama database user khusus, password panjang/unik, dan jangan pernah membagikan URI. Untuk keamanan lebih ketat, gunakan fitur fixed egress/private networking dari paket hosting yang mendukungnya.

### 4. Salin connection string

1. Di halaman cluster, pilih **Connect → Drivers**.
2. Pilih Node.js jika diminta.
3. Salin connection string dari Atlas.
4. Ganti bagian username, password, dan nama database. Contoh bentuknya:

```text
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/tagihan_wifi?retryWrites=true&w=majority
```

Jangan menyalin teks contoh di atas apa adanya. Gunakan host cluster dari Atlas dan kredensial database yang baru dibuat.

## Menjalankan di Komputer Sendiri

### 1. Unduh source code

1. Buka repository di GitHub.
2. Pilih **Code → Download ZIP**, lalu ekstrak ZIP tersebut; atau minta bantuan pengelola repository untuk menyalinnya.
3. Buka folder project di VS Code.

### 2. Buat file konfigurasi lokal

Di folder utama project, buat file bernama `.env.local`. File ini tidak masuk Git karena sudah diabaikan oleh `.gitignore`.

Isi dengan nilai milik Anda sendiri:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/tagihan_wifi?retryWrites=true&w=majority
JWT_SECRET=GANTI_DENGAN_SECRET_RANDOM_PANJANG
```

`JWT_SECRET` dipakai untuk menandatangani sesi login. Buat nilai acak yang panjang dan rahasiakan. Jika OpenSSL tersedia, Anda dapat membuatnya dari Terminal dengan:

```bash
openssl rand -base64 48
```

Jangan menggunakan secret contoh, password database, atau nilai yang pernah dipublikasikan.

### 3. Instal dan jalankan aplikasi

Di VS Code, buka **Terminal → New Terminal**, pastikan terminal berada di folder utama project, lalu jalankan:

```bash
npm install
npm run dev
```

Tunggu sampai terminal menampilkan alamat lokal, biasanya `http://localhost:3000`, kemudian buka alamat tersebut di browser.

### 4. Buat data awal lokal

Untuk membuat akun admin dan paket contoh pada database yang masih kosong, buka terminal kedua dan jalankan:

```bash
curl -X POST http://localhost:3000/api/seed
```

Untuk PowerShell Windows, gunakan:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/seed"
```

Dalam mode lokal, akun awal yang dibuat adalah username `admin` dan password `admin123`. Segera masuk lalu ganti password di halaman **Profil**. Jangan memakai password contoh ini pada server publik.

Perintah pemeriksaan yang tersedia:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy ke Vercel

Vercel adalah pilihan yang paling sederhana untuk aplikasi Next.js ini. Simpan source di GitHub terlebih dahulu.

### 1. Hubungkan GitHub

1. Masuk ke [Vercel](https://vercel.com/) menggunakan akun GitHub.
2. Pilih **Add New → Project**.
3. Pilih repository aplikasi dan tekan **Import**.
4. Biarkan Vercel mendeteksi framework Next.js dan perintah build otomatis.

### 2. Masukkan environment variables

Di pengaturan project Vercel, buka **Settings → Environment Variables**. Tambahkan:

| Nama | Isi |
|---|---|
| `MONGODB_URI` | Connection string MongoDB Atlas |
| `JWT_SECRET` | Secret random panjang untuk sesi login |
| `SEED_SECRET` | Secret random lain, hanya untuk proses membuat akun awal production |
| `INITIAL_ADMIN_PASSWORD` | Password kuat untuk akun admin pertama |

Pilih environment yang sesuai, biasanya **Production** dan **Preview** bila diperlukan. Jangan beri awalan `NEXT_PUBLIC_` pada variable rahasia ini. Setelah mengubah variable, lakukan deployment ulang agar perubahan terbaca.

### 3. Deploy

Pilih **Deploy** dan tunggu proses selesai. Jika gagal, buka **Deployment → Build Logs**. Pastikan database URI benar, Atlas mengizinkan koneksi, dan semua variable sudah tersimpan.

### 4. Buat admin pertama

Setelah domain Vercel aktif dan variable production terpasang, panggil endpoint seed **satu kali**. Ganti dua placeholder dengan domain dan nilai milik Anda:

```bash
curl -X POST "https://DOMAIN-ANDA/api/seed" \
  -H "x-seed-secret: NILAI_SEED_SECRET"
```

Contoh domain berbentuk `https://nama-aplikasi.vercel.app`; jangan menulis `DOMAIN-ANDA` secara literal. Di Windows PowerShell, perintahnya:

```powershell
Invoke-RestMethod -Method Post -Uri "https://DOMAIN-ANDA/api/seed" -Headers @{ "x-seed-secret" = "NILAI_SEED_SECRET" }
```

Jika berhasil, server membalas `Seed berhasil`. Masuk dengan username `admin` dan password yang Anda masukkan pada `INITIAL_ADMIN_PASSWORD`, lalu segera ganti password melalui **Profil**.

Setelah admin berhasil dibuat, hapus `SEED_SECRET` dan `INITIAL_ADMIN_PASSWORD` dari Environment Variables hosting lalu deploy ulang. Jangan menghapus `MONGODB_URI` atau `JWT_SECRET`.

## Deploy Socket.IO Terpisah

Socket.IO membutuhkan proses server Node.js yang terus berjalan. Karena website utama berjalan di Vercel, jalankan server Socket.IO sebagai **Web Service terpisah**, misalnya di Render. Ini bukan project Vercel baru dan tidak perlu repository GitHub baru: starter server sudah ada di folder `socket-server/` dalam repository yang sama, dan Render akan menjalankan folder itu sebagai layanan sendiri.

> Event realtime yang tersedia saat ini adalah notifikasi `payment.received`, khusus untuk akun admin dan collector. Event ini bukan sumber data utama; database tetap menjadi sumber kebenaran.

### 1. Jalankan starter server secara lokal

File server sudah tersedia di `socket-server/server.js`. Dari folder utama repository, jalankan:

```bash
cd socket-server
npm install
```

Untuk menguji dari website lokal, tambahkan URL ini ke `.env.local` di folder utama repository:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
SOCKET_SERVER_URL=http://localhost:3001
SOCKET_PUBLISH_SECRET=secret-random-lokal-yang-sama-dengan-server-socket
```

Gunakan nilai acak yang berbeda dari `JWT_SECRET` untuk `SOCKET_PUBLISH_SECRET`. Jalankan server dengan origin Next.js lokal dan dua secret yang sama dengan aplikasi. Contoh Bash membaca secret dari `.env.local`, tanpa mencetak nilainya:

```bash
JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' ../.env.local)" SOCKET_PUBLISH_SECRET="$(sed -n 's/^SOCKET_PUBLISH_SECRET=//p' ../.env.local)" APP_ORIGIN=http://localhost:3000 npm start
```

Di PowerShell, gunakan:

```powershell
$env:JWT_SECRET = (Get-Content ..\.env.local | Where-Object { $_ -match '^JWT_SECRET=' }) -replace '^JWT_SECRET=', ''
$env:SOCKET_PUBLISH_SECRET = (Get-Content ..\.env.local | Where-Object { $_ -match '^SOCKET_PUBLISH_SECRET=' }) -replace '^SOCKET_PUBLISH_SECRET=', ''
$env:APP_ORIGIN = "http://localhost:3000"
npm start
```

Biarkan proses ini berjalan saat menguji, lalu mulai ulang Next.js agar membaca URL dan secret publisher. Komponen client sudah meminta tiket saat connect/reconnect dan menampilkan toast pembayaran.

### 2. Deploy folder server ke Render

1. Di Render, pilih **New → Web Service**, lalu hubungkan repository GitHub yang sama dengan website.
2. Pada pengaturan layanan, isi **Root Directory** dengan `socket-server`.
3. Isi **Build Command** dengan `npm ci` dan **Start Command** dengan `npm start`.
4. Tambahkan `APP_ORIGIN` dengan origin website Vercel yang persis, misalnya `https://nama-aplikasi.vercel.app` (tanpa garis miring di akhir). Beberapa origin boleh dipisahkan koma; jangan gunakan wildcard untuk Preview.
5. Tambahkan `JWT_SECRET` dengan nilai rahasia yang sama persis seperti di Vercel. Tandai sebagai secret di Render dan jangan beri awalan `NEXT_PUBLIC_`.
6. Tambahkan `SOCKET_PUBLISH_SECRET` dengan nilai acak terpisah yang sama dengan environment Vercel, dan tandai sebagai secret.
7. Isi **Health Check Path** dengan `/health`, lalu buat layanan dan tunggu sampai statusnya berjalan.

Render menyediakan variable `PORT`; jangan menetapkan `PORT` sendiri. Setelah deploy, catat URL layanan Render, misalnya `https://nama-socket.onrender.com`.

### 3. Hubungkan website Vercel ke server

1. Di Vercel, buka **Project → Settings → Environment Variables**.
2. Tambahkan `NEXT_PUBLIC_SOCKET_URL` dengan URL layanan Render, misalnya `https://nama-socket.onrender.com`.
3. Tambahkan `SOCKET_SERVER_URL` dengan URL Render yang sama. Variable ini server-only, jangan beri awalan `NEXT_PUBLIC_`.
4. Tambahkan `SOCKET_PUBLISH_SECRET` yang sama dengan secret di Render. Pastikan `JWT_SECRET` juga sama persis di Vercel dan Render.
5. Pilih environment yang dipakai, biasanya **Production**, lalu lakukan redeploy. Client Socket.IO sudah dipasang pada layout aplikasi.

### 4. Hak akses dan pengujian

Server membatasi origin dan memverifikasi tiket bertanda tangan ketika handshake. Endpoint `POST /api/auth/socket-ticket` menerbitkan tiket 15 menit setelah sesi dan status akun diperiksa. Peran dalam tiket menentukan room: event pembayaran dikirim hanya ke room `admin` dan `collector`, bukan role `user`.

`payment.received` dipancarkan dari `POST /api/billings` setelah pembayaran tersimpan. Payload hanya memuat nama pelanggan, nominal, periode, metode, pencatat, dan waktu. Jika Socket.IO sedang tidak tersedia, pembayaran tetap berhasil tersimpan tetapi notifikasi realtime bisa terlewat; jangan jadikan socket satu-satunya catatan transaksi.

Untuk menguji, buka sesi admin/collector dan sesi role `user`, lalu catat pembayaran. Admin dan collector harus mendapat toast `Pembayaran diterima`; user tidak. Jangan mengekspos `JWT_SECRET`, `SOCKET_PUBLISH_SECRET`, atau `MONGODB_URI` dengan awalan `NEXT_PUBLIC_`. Jika nanti ada event lain, batasi penerima dan otorisasi event tersebut secara terpisah. Jika server dijalankan di beberapa instance, tambahkan adapter Socket.IO seperti Redis agar broadcast antar-instance berfungsi.

## Alternatif Deploy

### Netlify

Repository ini sudah memiliki `netlify.toml` dan plugin Next.js.

1. Masuk ke [Netlify](https://www.netlify.com/) dan hubungkan akun GitHub.
2. Pilih **Add new site → Import an existing project** dan pilih repository ini.
3. Biarkan Netlify membaca konfigurasi `netlify.toml`. Konfigurasi build menggunakan `npx next build` dan plugin Next.js.
4. Buka **Site configuration → Environment variables**.
5. Tambahkan `MONGODB_URI`, `JWT_SECRET`, `SEED_SECRET`, dan `INITIAL_ADMIN_PASSWORD` dengan cara yang sama seperti pada Vercel.
6. Deploy site. Setelah domain aktif, jalankan endpoint seed satu kali, ganti URL dengan domain Netlify Anda, lalu hapus `SEED_SECRET` dan `INITIAL_ADMIN_PASSWORD` setelah admin berhasil dibuat.

Pastikan pengaturan Network Access Atlas mengizinkan koneksi dari hosting Netlify. Untuk paket tanpa alamat egress tetap, aturan IP Atlas yang ketat dapat memerlukan konfigurasi jaringan tambahan.

### Render

Render menjalankan aplikasi sebagai layanan Node.js.

1. Masuk ke [Render](https://render.com/) dan pilih **New → Web Service**.
2. Hubungkan GitHub, lalu pilih repository ini.
3. Pilih runtime **Node**.
4. Isi perintah:

   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start`

5. Pada bagian **Environment**, tambahkan `MONGODB_URI`, `JWT_SECRET`, `SEED_SECRET`, dan `INITIAL_ADMIN_PASSWORD`.
6. Buat Web Service dan tunggu deployment selesai.
7. Buat akun admin satu kali melalui `/api/seed`, lalu hapus `SEED_SECRET` dan `INITIAL_ADMIN_PASSWORD` setelah berhasil.

Pada paket gratis, layanan Render dapat tidur saat tidak digunakan sehingga kunjungan pertama setelah lama tidak aktif terasa lebih lambat. Periksa juga apakah paket yang dipilih memiliki alamat IP keluar tetap untuk aturan Network Access MongoDB Atlas.

## Keamanan

- Jangan pernah memasukkan `.env.local` atau secret ke GitHub. Jangan kirim screenshot yang memperlihatkan nilai secret.
- Gunakan password berbeda untuk akun Atlas, admin aplikasi, `JWT_SECRET`, dan `SEED_SECRET`.
- Jangan memakai `admin123` pada server production.
- Header keamanan termasuk Content Security Policy berbasis nonce dan HSTS production; tes kebijakan dan guard API dijalankan dengan `npm test`.
- Batasi akses database ke database user aplikasi dan database yang diperlukan.
- Setelah setup admin awal, hapus `SEED_SECRET` dan `INITIAL_ADMIN_PASSWORD` dari konfigurasi hosting.
- Jika URI atau secret pernah terpublikasi, segera ganti di Atlas/hosting dan lakukan deployment ulang.
- Fitur arsip menyimpan data pelanggan, tetapi **hapus permanen** juga menghapus riwayat tagihan pelanggan tersebut.

## Solusi Masalah Umum

### Aplikasi gagal tersambung ke MongoDB

Periksa `MONGODB_URI`, username/password database, nama database, dan Network Access Atlas. Jika password berisi karakter khusus, pastikan sudah di-URL-encode. Pastikan juga database user mempunyai izin baca/tulis yang sesuai.

### Login tidak berhasil setelah deploy

Pastikan `JWT_SECRET` terpasang di environment **Production**, lalu lakukan deployment ulang. Secret yang berubah akan membatalkan sesi login sebelumnya, jadi masuk kembali.

### `/api/seed` membalas 404 di production

Endpoint production memerlukan header `x-seed-secret` yang nilainya sama persis dengan `SEED_SECRET` di hosting. Jangan membagikan nilai ini. Jika akun sudah ada, masuk sebagai admin untuk mengelola akun; jangan menjalankan setup awal ulang pada database yang sudah dipakai.

### Perubahan variable tidak berpengaruh

Setelah mengubah Environment Variables di Vercel, Netlify, atau Render, lakukan **redeploy**. Variable pada `.env.local` hanya digunakan untuk komputer sendiri.

### Deploy gagal

Buka build/deploy log di layanan hosting dan cari pesan error pertama. Pastikan repository dapat diakses, perintah build sesuai, Node.js menggunakan versi 20 atau lebih baru, serta variable database dan JWT tersedia.
