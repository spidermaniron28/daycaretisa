# E-Rapor Daycare

Aplikasi jurnal harian anak daycare dengan tiga portal — **Administrator**, **Guru**, dan **Orang Tua**.
Database tetap **Google Spreadsheet**, berkas foto tetap **Google Drive**, tapi frontend dan backend
sekaligus berjalan di **Vercel** (Next.js).

Ini adalah pengganti aplikasi Google Apps Script (`Index.html`, `Kode.gs`, `Login.html`,
`Dashboard.html`, `JavaScript.html`) yang ada di folder ini. Kelima berkas `.txt` tersebut
dipakai sebagai acuan fitur dan **tidak dihapus** — masih bisa dipakai sebagai aplikasi lama.

---

## Apa yang Berbeda dari Versi Apps Script

Aplikasi lama memakai `google.script.run` dan `HtmlService.include()`. Keduanya **hanya ada di
dalam sandbox Apps Script** dan tidak bisa jalan di domain Vercel. Karena itu:

| Aspek | Versi lama (Apps Script) | Versi ini (Next.js + Vercel) |
|---|---|---|
| Menjalankan di | `script.google.com` | Domain Vercel Anda |
| Akses data | `google.script.run` | Route Handler → Google Sheets API |
| Unggah foto | base64 lewat `google.script.run` (batas payload kecil, sering gagal) | `multipart/form-data` → Drive |
| Password | polos, tersimpan di kolom `Password` | hash **scrypt**, kolom `PasswordHash` |
| Sesi | tidak ada (tetap login) | JWT 8 jam di cookie `httpOnly` |
| Identitas laporan | nomor baris sheet (rawan geser) | UUID di kolom `Id Laporan` |

### Lima cacat lama yang sudah diperbaiki

1. **Password terekspos.** `getDataAkun()` mengirim password polos ke browser dan tabel admin
   menampilkannya. Siapa pun yang membuka DevTools bisa membaca semua password siswa & guru.
   Sekarang kolom password tidak pernah dikirim ke browser — hanya status *Terproteksi*.
2. **Backdoor login.** `cekLogin()` punya jalur bypass `username==='1' && password==='1'`.
   Sudah dihapustotal.
3. **`row_id` = nomor baris sheet.** `deleteRow()` menggeser semua baris di bawahnya, sehingga
   laporan lama bisa membuka **data anak yang salah** saat diedit. Diganti UUID.
4. **XSS.** Nama siswa disisipkan lewat `innerHTML` tanpa escape. Di React ini tidak mungkin.
5. **Upload gagal.** Foto besar gagal karena dikirim sebagai base64. Sekarang dikompres di browser
   (±150–400 KB) lalu diunggah sebagai multipart.

---

## 1. Prasyarat

- Akun Google (email apa pun, tidak wajib Workspace)
- Akun [Vercel](https://vercel.com) — gratis cukup
- Node.js 20 atau lebih baru

---

## 2. Buat Service Account

Service Account adalah "pengguna robot" yang dipakai server untuk membaca spreadsheet dan
menulis ke Drive. Kredensialnya **tidak pernah** masuk ke browser.

1. Buka <https://console.cloud.google.com/> → buat project baru (atau pilih yang sudah ada).
2. **APIs & Services → Library** → aktifkan dua API ini:
   - **Google Sheets API**
   - **Google Drive API**
3. **APIs & Services → Credentials → Create Credentials → Service Account**.
4. Klik akun service account yang dibuat → **Keys → Add key → Create new key** → pilih **JSON**.
5. Salin nilai `client_email` dan `private_key` — akan dipakai di langkah berikutnya.

---

## 3. Siapkan Google Spreadsheet

1. Buka spreadsheet yang **sudah dipakai aplikasi lama** (jangan buat baru).
2. **Share** → masukkan `client_email` tadi →hak akses **Editor**.
   *Tanpa ini semua permintaan akan gagal dengan 403.*
3. Buat folder di Google Drive untuk menampung semua unggahan, lalu **Share** folder itu juga
   ke `client_email` (Editor). Catat **ID folder**-nya — ini `GOOGLE_DRIVE_FOLDER_ID`.
   > Folder ini penting: file yang dibuat service account akan mendarat di folder bersama ini,
   > bukan di Drive pribadi robot yang tidak terlihat siapa pun.

---

## 4. Konfigurasi Lokal

```bash
npm install
cp .env.example .env
```

Isi `.env`:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=erapor-api@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
GOOGLE_DRIVE_FOLDER_ID=1XyZwVuTsRqPonMlKjIhGfEdCbA
SESSION_SECRET=<hasil dari: openssl rand -base64 48>
```

> `private_key` di dalam `.env` harus ditulis dengan `\n` (backslash-n), bukan enter asli.

### Menambahkan kolom baru ke spreadsheet

Skrip ini **idempoten dan non-destruktif** — hanya menambahkan kolom yang belum ada di sebelah
kanan. Kolom lama dan semua data Anda tidak disentuh sama sekali.

```bash
npm run setup:sheet
```

Kolom yang ditambahkan:

| Sheet | Kolom baru | Fungsi |
|---|---|---|
| `Akun` | `PasswordHash`, `Dibuat` | hash scrypt & tanggal pembuatan |
| `Siswa` | `Email Orang Tua`, `No WhatsApp` | kontak orang tua |
| `Guru` | `Email` | kontak guru |
| `Laporan` | `Id Laporan` | UUID laporan |

---

## 5. Jalankan

```bash
npm run dev
```

Buka <http://localhost:3000>. Login dengan akun yang sudah ada — password lama **tetap bisa
dipakai**, dan otomatis diamankan (di-hash) saat login pertama.

### Verifikasi

```bash
npm run typecheck   # cek tipe
npm run lint        # cek kualitas kode
npm run build       # build produksi

# Uji semua endpoint (jalankan dev server di terminal lain dulu)
npm run smoke
```

---

## 6. Migrasi Password

Normalnya password lama **otomatis** berubah menjadi hash saat pengguna login pertama kali —
tidak perlu ada tindakan. Kalau ingin mengubah semuanya sekaligus:

```bash
npm run migrate:password                        # dry-run, hanya melaporkan
npm run migrate:password -- --jalankan          # benar-benar mengubah
```

> ⚠️ **Password tidak bisa dikembalikan ke bentuk polos** setelah di-hash. Pastikan setiap
> pengguna sudah tahu sandinya, atau siapkan reset password dari menu Manajemen Akun.

---

## 7. Deploy ke Vercel

1. Push kode ke GitHub / GitLab.
2. Di Vercel: **Add New → Project** → pilih repository.
3. Framework terdeteksi otomatis sebagai **Next.js** — biarkan saja.
4. Tambahkan **semua variabel** dari `.env` ke menu **Settings → Environment Variables**
   (untuk setiap variabel, tandai juga untuk Production).
5. **Deploy.**

Tidak ada build command khusus. Folder `.txt` di root akan diabaikan Next.js.

---

## 8. Struktur Proyek

```
src/
├─ proxy.ts                     penjaga gerbang (Next 16 "proxy", bukan "middleware")
├─ app/
│  ├─ login/                    halaman login
│  ├─ admin/                    portal administrator
│  │  ├─ page.tsx               ringkasan & statistik
│  │  ├─ laporan/               rekap + export Excel + cetak PDF
│  │  ├─ siswa|guru|rombel/     master data
│  │  ├─ akun/                  manajemen akun pengguna
│  │  └─ sistem/                identitas sekolah & gambar
│  ├─ guru/                     portal guru (beranda, siswa, laporan, riwayat, profil)
│  ├─ ortu/                     portal orang tua (jurnal, profil)
│  └─ api/                      seluruh route handler
├─ components/                  komponen UI per fitur
├─ lib/
│  ├─ google.ts                 klien Sheets & Drive (di-cache)
│  ├─ sheets.ts                 repository — satu-satunya tempat bicara dengan sheet
│  ├─ drive.ts                  unggah berkas + beri izin publik
│  ├─ password.ts               hash scrypt
│  ├─ session.ts                JWT + cookie httpOnly
│  ├─ auth.ts                   layanan login + migrasi lazy
│  ├─ constants.ts              struktur kolom spreadsheet
│  ├─ validate.ts               skema zod
│  ├─ image.ts                  kompresi gambar di browser
│  └─ utils.ts                  pembantu
└─ scripts/
   ├─ setup-sheet.ts            tambah kolom baru (idempoten)
   ├─ migrate-password.ts       hash semua password lama
   └─ smoke.ts                  uji semua endpoint
```

---

## 9. Rencana Cutover

- **Jangan biarkan dua sistem menulis ke spreadsheet yang sama.** Setelah versi Vercel stabil,
  ubah deployment Apps Script lama menjadi read-only, atau hapus deploy-nya.
- **Uji urutan ini sebelum dipakai sekolah:**
  1. Login sebagai admin → cek semua data siswa & guru terbaca benar.
  2. Login sebagai guru → isi satu laporan harian, unggah 2 foto.
  3. Login sebagai orang tua → pastikan laporan + foto muncul, badge "LAPORAN BARU" berubah
     jadi "Sudah Dibaca" setelah dibuka.
  4. Coba role campur: guru tidak boleh membuka `/admin`, orang tua hanya melihat laporan
     anaknya sendiri.
- **Suara WhatsApp** sudah disiapkan: kolom `No WhatsApp` sudah ada di sheet `Siswa`, tinggal
  disambungkan ke gateway (Fonnte / WAHA) nanti.

---

## 10. Masalah yang Sering Muncul

| Gejala | Penyebab & Solusi |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL belum diisi` | `.env` belum dibuat atau salah nama variabel |
| `The caller does not have permission` (403) | Spreadsheet/folder belum di-share ke email service account |
| `Requested entity was not found` (404) | `GOOGLE_SPREADSHEET_ID` salah, atau sheet belum ada |
| Foto tidak tampil | Folder Drive belum di-share anyone-with-link |
| `Cannot find name 'google'` | Sudah tidak mungkin — itu salah paham yang lama; kode versi ini memakai `googleapis` |
| Build error `Unknown utility class` | Jangan menambah kelas kustom di `@layer components`; pakai `@utility` (lihat [globals.css](src/app/globals.css)) |