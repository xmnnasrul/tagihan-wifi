# WiFi Billing

Aplikasi web untuk mengelola pelanggan internet WiFi, paket, tagihan bulanan, pembayaran, kunjungan collector, dan laporan operasional.

Panduan ini ditujukan untuk pemilik aplikasi atau operator yang belum terbiasa dengan coding. Beberapa tahap tetap memerlukan akun GitHub, MongoDB Atlas, dan akun layanan hosting.

## Daftar Isi

- [Fitur](#fitur)
- [Yang Perlu Disiapkan](#yang-perlu-disiapkan)
- [Menyiapkan MongoDB Atlas](#menyiapkan-mongodb-atlas)
- [Menjalankan di Komputer Sendiri](#menjalankan-di-komputer-sendiri)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Menyiapkan Pusher untuk Chat Real-Time](#menyiapkan-pusher-untuk-chat-real-time)
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
- **Chat admin:** percakapan satu lawan satu antar-admin dengan enkripsi end-to-end untuk pesan, balasan, dan media; pesan diperbarui realtime dengan tanda terkirim, terbaca, dan gagal dikirim. Admin dapat mereset kunci Chat yang terlupa (riwayat lama disembunyikan dari akun yang direset) dan melihat detail foto profil, nama, serta bio admin lain. Kunci privat disimpan di browser; setiap admin perlu membuka halaman chat untuk pertama kali dari browser yang akan dipakai. Pesan dan media dihapus otomatis setelah 15 hari.
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
| `PUSHER_APP_ID` | App ID dari aplikasi Pusher Channels |
| `PUSHER_APP_KEY` | App Key dari aplikasi Pusher Channels |
| `PUSHER_APP_SECRET` | App Secret Pusher, hanya untuk server |
| `PUSHER_APP_CLUSTER` | Cluster aplikasi Pusher |
| `NEXT_PUBLIC_PUSHER_KEY` | Key Pusher yang sama untuk koneksi browser |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Cluster Pusher yang sama untuk koneksi browser |

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

## Menyiapkan Pusher untuk Chat Real-Time

Chat admin menggunakan Pusher Channels untuk notifikasi real-time. Pusher hanya meneruskan event `admin-chat:updated` tanpa isi pesan; ciphertext tetap diambil dari API dan didekripsi di browser. Jika Pusher belum dikonfigurasi atau koneksi terputus, chat tetap menyinkronkan pesan setiap lima detik saat percakapan terbuka.

### 1. Buat akun dan aplikasi Pusher Channels

Ikuti langkah berikut untuk mendapatkan kredensial yang dibutuhkan aplikasi:

1. Buka [Pusher Dashboard](https://dashboard.pusher.com/) dan buat akun, atau masuk jika sudah punya akun. Ikuti instruksi pendaftaran/verifikasi yang muncul.
2. Dari dashboard, pilih **Channels**. Pastikan produknya **Channels**, bukan Beams.
3. Pilih **Create app** atau **Get started** untuk membuat aplikasi Channels.
4. Isi nama aplikasi, misalnya `tagihan-wifi-chat`. Nama ini hanya label agar mudah dikenali.
5. Pilih **Cluster** yang disarankan Pusher atau yang paling dekat dengan lokasi pengguna aplikasi. Catat nilai cluster yang dipilih, misalnya `ap1` atau `us2`.
6. Jika diminta memilih framework atau frontend, pilihan itu hanya contoh integrasi Pusher. Aplikasi ini memakai Next.js; pilihan framework di dashboard tidak mengubah kode project.
7. Tekan tombol untuk membuat aplikasi. Setelah aplikasi dibuat, buka menu **App Keys**.
8. Di halaman **App Keys**, temukan dan salin **app_id**, **key**, **secret**, dan **cluster**. Simpan nilainya secara aman. Jangan kirim atau tempelkan **secret** ke chat, screenshot publik, atau kode frontend.

### 2. Tambahkan kredensial di Vercel

Karena website sudah di-deploy ke Vercel, tambahkan nilai tersebut ke pengaturan project:

1. Buka [Vercel Dashboard](https://vercel.com/dashboard), pilih project website ini.
2. Buka **Settings → Environment Variables**.
3. Tambahkan setiap variabel berikut satu per satu. Untuk masing-masing, isi **Name** sesuai tabel, **Value** dari Pusher, dan pilih environment **Production**. Jika chat juga ingin dipakai di Preview, pilih **Preview** juga.

| Name di Vercel | Value yang diisi |
|---|---|
| `PUSHER_APP_ID` | Nilai **app_id** dari halaman App Keys |
| `PUSHER_APP_KEY` | Nilai **key** dari halaman App Keys |
| `PUSHER_APP_SECRET` | Nilai **secret** dari halaman App Keys |
| `PUSHER_APP_CLUSTER` | Nilai **cluster** dari halaman App Keys |
| `NEXT_PUBLIC_PUSHER_KEY` | Nilai **key** yang sama dengan `PUSHER_APP_KEY` |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Nilai **cluster** yang sama dengan `PUSHER_APP_CLUSTER` |

Perhatikan huruf besar/kecil dan jangan menambahkan tanda kutip atau spasi pada awal/akhir nilai. `PUSHER_APP_SECRET` harus tetap tanpa awalan `NEXT_PUBLIC_` karena hanya boleh digunakan server.

4. Klik **Save** setelah setiap variabel ditambahkan.
5. Setelah keenam variabel disimpan, buka tab **Deployments**, pilih menu titik tiga pada deployment Production terbaru, lalu pilih **Redeploy**. Perubahan environment variable baru berlaku setelah deployment baru selesai.
6. Tunggu status deployment menjadi **Ready**.

### 3. (Opsional) Jalankan project di komputer sendiri

Untuk pengembangan lokal, tambahkan nilai yang sama ke file `.env.local` di folder utama project. Buat file tersebut jika belum ada. Jangan mengisi file `.env.example` dengan secret asli karena file itu contoh konfigurasi yang boleh dibagikan.

```env
PUSHER_APP_ID=isi-app-id-dari-pusher
PUSHER_APP_KEY=isi-key-dari-pusher
PUSHER_APP_SECRET=isi-secret-dari-pusher
PUSHER_APP_CLUSTER=isi-cluster-dari-pusher
NEXT_PUBLIC_PUSHER_KEY=isi-key-yang-sama
NEXT_PUBLIC_PUSHER_CLUSTER=isi-cluster-yang-sama
```

Ganti semua teks `isi-...` dengan nilai dari halaman App Keys. Pastikan `NEXT_PUBLIC_PUSHER_KEY` sama persis dengan `PUSHER_APP_KEY`, dan `NEXT_PUBLIC_PUSHER_CLUSTER` sama persis dengan `PUSHER_APP_CLUSTER`. Simpan `.env.local`, lalu mulai ulang server pengembangan agar nilainya dimuat. Jangan commit atau mengirimkan `.env.local`.

### 4. Otorisasi dan pengujian

Browser berlangganan ke private channel khusus ID admin yang sedang login. Endpoint `POST /api/pusher/auth` memeriksa sesi admin, status akun, status sandi Chat, serta memastikan admin hanya dapat mengautentikasi channel miliknya sendiri. Setelah perubahan chat tersimpan, server Next.js mengirim event kosong ke channel peserta; klien lalu mengambil pesan lewat API. Isi pesan tidak dikirim ke Pusher.

Untuk memastikan konfigurasi berhasil, buka chat admin di dua browser atau dua sesi admin yang berbeda, pastikan keduanya sudah memiliki sandi Chat, lalu kirim pesan dari salah satunya. Chat penerima seharusnya diperbarui tanpa refresh halaman. Jika tidak, periksa bahwa keenam variabel sudah benar dan deployment Vercel berstatus **Ready**. Chat tetap mencoba mengambil pesan otomatis berkala sebagai fallback. Jangan mengekspos `PUSHER_APP_SECRET`, `JWT_SECRET`, atau `MONGODB_URI` dengan awalan `NEXT_PUBLIC_`.

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
