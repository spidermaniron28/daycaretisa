import { bacaSession } from '@/lib/session'
import { pakaiState, simpanTokenBaru } from '@/lib/oauth-token'
import { tukarCode } from '@/lib/oauth'
import { invalidasiStatusKoneksi } from '@/lib/kesehatan'

export const dynamic = 'force-dynamic'
// Vercel: panggilan ke Google (unggah foto, tulis sheet) bisa lebih lambat dari
// batas bawaan 10 detik pada cold start.
export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * Langkah 2 "Hubungkan Ulang Drive": Google mengembalikan browser ke sini.
 *
 * Sengaja mengembalikan halaman HTML (bukan JSON) karena yang membuka alamat
 * ini adalah browser, bukan fetch(). Tidak memakai helper handler() dari
 * lib/api supaya kegagalan pun tetap tampil sebagai halaman yang bisa dibaca.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const sesi = await bacaSession()
  if (!sesi || sesi.role !== 'admin') {
    return halaman(
      'Sesi tidak ditemukan',
      'Hubungkan ulang harus dijalankan dari aplikasi sebagai admin. Silakan login sebagai admin lalu klik tombolnya lagi.',
      false,
    )
  }

  if (error) {
    return halaman(
      'Izin tidak diberikan',
      `Google mengembalikan: <b>${aman(error)}</b>. Coba klik Hubungkan Ulang Drive lagi dan pilih Allow pada layar izin.`,
      false,
    )
  }

  if (!code) {
    return halaman('Kode tidak diterima', 'Google tidak mengirim authorization code.', false)
  }

  if (!pakaiState(state)) {
    return halaman(
      'Permintaan kedaluwarsa',
      'Tautan izin ini sudah kedaluwarsa atau tidak cocok (berlaku 15 menit). Silakan klik Hubungkan Ulang Drive lagi dari halaman Sistem &amp; Akses.',
      false,
    )
  }

  try {
    const token = await tukarCode(code, origin)
    const hasil = await simpanTokenBaru(token)
    invalidasiStatusKoneksi()

    return halaman(
      'Google Drive berhasil terhubung ulang',
      `${aman(hasil.pesan)} Tutup tab ini, lalu klik <b>Periksa Ulang</b> di halaman Sistem &amp; Akses.`,
      true,
    )
  } catch (e) {
    const pesan = (e as Error).message
    const petunjuk = /redirect_uri_mismatch/i.test(pesan)
      ? ' Redirect URI belum terdaftar di Google Cloud → Clients → Authorized redirect URIs.'
      : ''
    return halaman('Gagal menghubungkan', `${aman(pesan)}${petunjuk}`, false)
  }
}

/* ------------------------------- Halaman HTML ----------------------------- */

function aman(teks: string): string {
  return teks.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function halaman(judul: string, pesan: string, sukses: boolean): Response {
  const warna = sukses ? '#059669' : '#dc2626'
  const ikon = sukses ? '✅' : '⚠️'

  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${aman(judul)} — E-Rapor Daycare</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#f3f4f6;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px}
  .kartu{background:#fff;border-radius:16px;padding:32px;max-width:520px;width:100%;
         box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center}
  .ikon{font-size:40px;line-height:1}
  h1{font-size:18px;margin:12px 0 8px;color:${warna}}
  p{font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px}
  a{display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;
    padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600}
</style></head>
<body>
  <div class="kartu">
    <div class="ikon">${ikon}</div>
    <h1>${aman(judul)}</h1>
    <p>${pesan}</p>
    <a href="/admin/sistem">Kembali ke Sistem &amp; Akses</a>
  </div>
  <script>
    // Bila dibuka sebagai tab baru dari tombol di aplikasi, tutup sendiri.
    if (window.opener) { setTimeout(function () { window.close() }, 2000) }
  </script>
</body></html>`

  return new Response(html, {
    status: sukses ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
