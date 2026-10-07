# Menghubungkan ke GitHub & Vercel

Panduan ini menjawab satu pertanyaan: **apa yang aman diunggah, apa yang harus
diisi di Vercel, dan apa yang membuat koneksi Drive tetap hidup.** Ditulis untuk
kondisi aplikasi saat ini (OAuth consent screen Google masih berstatus
*Testing*, lihat bagian terakhir).

---

## 1. Apa yang aman masuk GitHub

`git status` **tidak boleh** pernah menampilkan berkas berikut sebagai
"changes to be committed":

| Berkas | Isi | Status |
|---|---|---|
| `.env.local` | semua rahasia (Service Account, token Drive, SESSION_SECRET) | sudah di `.gitignore` ✅ |
| `*.pem` | kunci privat | sudah di `.gitignore` ✅ |
| `.vercel/` | id proyek Vercel | sudah di `.gitignore` ✅ |
| `.env.example` | hanya contoh/template | **memang diunggah** ✅ |

Sebelum `git add` pertama kali, pastikan:

```bash
git check-ignore -v .env.local .env .vercel
# setiap baris harus muncul — artinya diabaikan
git status --porcelain | grep -i "env\|pem"   # harus KOSONG
```

Yang **bukan** rahasia dan aman diunggah: seluruh `src/`, `scripts/`, `.freebuff/`
(catatan kerja), `DEPLOY.md`, `.env.example`, `package.json`.

> Catatan: `scripts/oauth-drive.ts` menulis token ke `.env.local` di komputer.
> Berkas itu tidak pernah ikut terunggah, jadi token tidak bocor ke GitHub —
> tetapi juga berarti **skrip terminal itu tidak berguna untuk Vercel**; di
> Vercel, hubungkan Drive lewat tombol di aplikasi (bagian 3).

---

## 2. Mengisi Environment Variables di Vercel

Vercel → Project → Settings → Environment Variables. Ambil nilainya dari
`.env.local` di komputer (buka dengan Notepad), isi satu per satu untuk
**Production** (dan Preview bila perlu):

| Nama | Wajib | Catatan |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ya | dari JSON Service Account |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | ya | tempel apa adanya, biarkan `\n` sebagai teks — kode sudah mengubahnya jadi baris baru |
| `GOOGLE_SPREADSHEET_ID` | ya | dari URL spreadsheet |
| `GOOGLE_DRIVE_FOLDER_ID` | ya | folder foto profil |
| `GOOGLE_DRIVE_FOLDER_KEGIATAN` | ya | folder foto kegiatan |
| `GOOGLE_OAUTH_CLIENT_ID` | ya | dari Google Cloud → Clients |
| `GOOGLE_OAUTH_CLIENT_SECRET` | ya | dari Google Cloud → Clients |
| `SESSION_SECRET` | ya | **pakai nilai yang SAMA dengan lokal** — lihat catatan di bawah, minimal 32 karakter |
| `SESSION_TTL_HOURS` | tidak | default 8 jam |
| `SMTP_*`, `SMTP_FROM` | tidak | hanya untuk notifikasi email |
| `NEXT_PUBLIC_APP_URL` | ya | `https://<nama-app>.vercel.app` |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | **tidak** | sengaja dikosongkan — lihat bagian 3 |
| `GOOGLE_OAUTH_CONNECTED_AT` | tidak | sama, diisi otomatis oleh aplikasi |
| `UJI_GURU_USERNAME` / `UJI_GURU_PASSWORD` | tidak | hanya untuk skrip uji di komputer, jangan diisi di produksi |

### Cara mengisi: pakai tombol **Import .env**

Berkas **`.env.vercel`** sudah disiapkan di folder proyek — isinya sudah tepat:
9 kunci wajib + `NEXT_PUBLIC_APP_URL`, **tanpa** token OAuth dan tanpa kredensial
uji. Di halaman import Vercel, klik **Import .env** lalu pilih berkas itu.

> `.env.vercel` memuat rahasia asli dan sudah di-`.gitignore` (diverifikasi dengan
> `git check-ignore -v .env.vercel`). Jangan pernah di-commit.

### Kenapa `SESSION_SECRET` harus sama dengan lokal

Token Drive di spreadsheet disimpan **terenkripsi dengan kunci turunan
`SESSION_SECRET`**. Kalau Vercel memakai `SESSION_SECRET` berbeda, baris token itu
tidak bisa dibuka: Drive akan berstatus **PUTUS** (bukan error) dan Anda perlu
menekan **Hubungkan Ulang Drive** sekali setelah deploy supaya token baru
terenkripsi dengan rahasia produksi. Boleh dipilih, tapi sadari konsekuensinya.

`GOOGLE_OAUTH_REFRESH_TOKEN` **tidak perlu** diisi di Vercel karena token
disimpan di spreadsheet (bagian 3), sehingga mengganti token tidak memerlukan
redeploy dan langsung berlaku untuk semua instance.

---

## 3. Kenapa koneksi Drive tetap hidup di Vercel

Di lokal token disimpan di `.env.local`. Di Vercel berkas itu tidak ada dan
filesystem-nya hanya-baca, jadi:

- **token hasil "Hubungkan Ulang Drive" disimpan ke spreadsheet** — baris rahasia
  di sheet `Pengaturan`: `_oauth_refresh_token` (terenkripsi AES-256-GCM dengan
  kunci turunan `SESSION_SECRET`) dan `_oauth_connected_at`;
- baris berawalan `_` **tidak pernah** ikut `listPengaturan()`, jadi token tidak
  bocor ke halaman login atau ke prop komponen client;
- saat membaca, urutan prioritasnya: hasil consent di proses ini → spreadsheet →
  `process.env`. Jadi satu klik hubungkan-ulang **langsung berlaku untuk semua
  instance serverless** tanpa redeploy;
- karena token di sheet terenkripsi dengan `SESSION_SECRET`, **nilai rahasia itu
  harus sama** di komputer dan di Vercel selama token lama masih dipakai;
- state anti-CSRF alur OAuth kini ditandatangani HMAC (stateless), bukan disimpan
  di memori — request pembuat state dan request callback boleh dilayani instance
  yang berbeda.

Bukti: `.freebuff/cek-token-vercel.ts` menghapus `GOOGLE_OAUTH_REFRESH_TOKEN` dari
env (kondisi Vercel) lalu memanggil Drive sungguhan → tetap **TERHUBUNG** sebagai
`spiderman.iron28@gmail.com`.

### Langkah sekali di Google Cloud (wajib sebelum tombol dipakai)

1. Buka <https://console.cloud.google.com/auth/clients?project=erapor-daycare>
2. Klik klien OAuth yang dipakai → **Authorized redirect URIs** → **Add URI**
3. Tambahkan (dua-duanya, lokal + produksi):
   - `http://localhost:3000/api/oauth/callback`
   - `https://<nama-app>.vercel.app/api/oauth/callback`
4. **Save**

Tanpa ini Google menolak dengan `redirect_uri_mismatch`. Alamat yang harus
didaftarkan selalu ditampilkan di dalam aplikasi (halaman **Sistem & Akses**),
dihitung dari alamat yang sedang dipakai.

---

## 4. Batas teknis Vercel yang perlu diketahui

- **Ukuran request maksimum 4,5 MB** per panggilan serverless. Foto sudah
  dikompres di browser (biasanya 50–170 KB), jadi aman. Yang perlu diingat:
  logo/background di halaman Pengaturan **tidak** dikompres dan dibatasi 3 MB
  oleh server — masih di bawah batas, tapi jangan dinaikkan melewati 4,5 MB.
- `experimental.serverActions.bodySizeLimit: '12mb'` di `next.config.ts` **hanya
  berlaku di lokal**; di Vercel batasnya tetap 4,5 MB.
- Route berat (`/api/upload`, `/api/laporan`, `/api/laporan/*`, `/api/kesehatan`,
  `/api/oauth/callback`) sudah diberi `maxDuration = 60` supaya cold start +
  panggilan Google tidak kena timeout bawaan.
- Preview Deployment punya domain acak sendiri. Kalau tombol Hubungkan Ulang
  dipakai dari domain preview, Google akan menolak (`redirect_uri_mismatch`).
  **Selalu hubungkan ulang dari domain produksi.**
- Cron Vercel (Hobby: 1×/hari) bisa dipakai untuk mengingatkan sebelum token
  berumur 7 hari — belum dipasang, lihat bagian 6.

---

## 5. Urutan deploy yang disarankan

**Status 2026-10-07** — langkah 1–3 sudah selesai:

- repo git lokal dibuat di folder ini, cabang `main`, commit awal `0ef4338`
  dengan 94 berkas (`.env.local`, `.freebuff/`, log, dan kode Apps Script lama
  tidak diikutsertakan);
- remote: <https://github.com/spidermaniron28/daycaretisa> — push selesai,
  `git status -sb` bersih (`main...origin/main`);
- identitas commit diset **lokal repo ini saja**: `Saenz <spidermaniron28@users.noreply.github.com>`;
- git di komputer ini menolak folder karena kepemilikan SID berbeda, jadi ditambahkan
  pengecualian `git config --global --add safe.directory 'D:/1. SAENZ/2. APLIKASI SAENZ/Erapor Daycare'`
  (hanya folder ini; bisa dibatalkan dengan `--unset`).

**Sisa langkah:**

1. Repo GitHub saat ini **PUBLIK** — ubah ke privat bila aplikasi tidak ingin
   dilihat orang: repo → Settings → General → Danger Zone → Change visibility →
   *Make private*.
2. Import repo di Vercel → isi Environment Variables (bagian 2) → Deploy.
   Alamat import: <https://vercel.com/import>.
3. Catatan paket: Vercel **Hobby gratis** hanya untuk pemakaian pribadi /
   non-komersial. Bila aplikasi ini dipakai untuk usaha daycare, ketentuannya
   memerlukan paket **Pro**.
4. Buka `https://<domain>/login`, masuk sebagai admin.
5. Buka **Sistem & Akses** → pastikan dua baris **TERHUBUNG**.
6. Daftarkan redirect URI produksi (bagian 3), lalu klik **Hubungkan Ulang Drive**
   → setujui di Google (Advanced → Continue) → **Periksa Ulang** → **Uji Unggah Foto**.
7. Coba unggah satu foto profil dan satu laporan dengan foto dari HP guru.
8. Setelah import selesai, setiap `git push` ke `main` otomatis memicu deploy
   produksi, dan setiap branch/PR mendapat Preview Deployment sendiri.

---

## 6. Sisa risiko yang belum bisa hilang

Selama app Google masih berstatus **Testing**, Google mencabut refresh token
setiap 7 hari — ini kebijakan Google, bukan bug aplikasi. Karena itu:

- panel Sistem & Akses menampilkan peringatan kuning mulai hari ke-5;
- kalau token mati, cukup klik **Hubungkan Ulang Drive** (30 detik, tanpa
  terminal, tanpa redeploy);
- agar benar-benar permanen, app harus berstatus *In production* lewat tombol
  **Publish app** di Google Cloud → Audience. Pada proyek Google milik sekolah
  tombol itu **tidak dirender** (bug Google yang dilaporkan di issue tracker
  mereka). Jalan keluar: buka tampilan lama OAuth consent screen, lengkapi
  halaman Branding, atau buat proyek Google Cloud baru.

---

## 7. Pemeriksaan otomatis (CI)

`.github/workflows/ci.yml` menjalankan **typecheck → lint → build** pada setiap
`push` dan `pull request`. Rincian penting:

- berjalan di **Node 22** (versi yang dipakai Vercel untuk proyek baru), memakai
  `npm ci` sehingga versi dependensinya sama persis dengan yang diuji di komputer;
- **tanpa Environment Variables** — sengaja. Build produksi sudah diverifikasi
  sukses tanpa env (semua halaman mengambil data Google saat request), jadi kalau
  CI gagal, itu memang pertanda masalah kode, bukan sekadar env kosong;
- push baru ke branch yang sama otomatis membatalkan pemeriksaan yang masih
  berjalan (`concurrency`), supaya hemat menit runner.

Hasil run pertama (commit `3271da6`): **success**, 45 detik —
`npm ci` 11s, typecheck 8s, lint 4s, build 15s.

**Catatan:** CI ini melapor, tidak memblokir. Vercel tetap men-deploy sendiri
begitu ada push ke `main`. Kalau ingin deploy benar-benar ditahan saat CI merah,
aktifkan di GitHub → Settings → Branches → tambahkan aturan untuk `main` dan
centang **Require status checks to pass** → pilih `Typecheck, lint, build`.

Repo **publik** memakai menit Actions tanpa batas; setelah diubah menjadi privat,
satu run ≈ 1 menit dari kuota gratis 2.000 menit/bulan.
