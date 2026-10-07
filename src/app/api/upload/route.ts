import { handler, ok, gagal } from '@/lib/api'
import { uploadBuffer } from '@/lib/drive'
import type { FolderUpload } from '@/lib/google'
import { wajibRole } from '@/lib/session'

export const dynamic = 'force-dynamic'
// Vercel: panggilan ke Google (unggah foto, tulis sheet) bisa lebih lambat dari
// batas bawaan 10 detik pada cold start.
export const maxDuration = 60
export const runtime = 'nodejs'

const TIPE_DIIZINKAN = ['image/jpeg', 'image/png', 'image/webp']
/** Batas per berkas — 3MB sudah jauh di atas hasil kompresi Canvas (≈150–400KB). */
const MAKS_PER_FILE = 3 * 1024 * 1024
const MAKS_TOTAL = 8 * 1024 * 1024
const MAKS_BERKAS = 6

/**
 * Upload foto ke Google Drive.
 *
 * Menerima multipart/form-data (field "files") — bukan JSON base64. Ini penting
 * karena aplikasi lama mengirim base64 lewat google.script.run yang punya batas
 * payload kecil dan sering gagal saat foto beresolusi besar.
 *
 * Field "jenis" menentukan folder tujuan di Drive:
 *  - "kegiatan" → folder foto kegiatan (foto laporan harian)
 *  - "profil"   → folder foto profil (foto profil, logo, background)
 * Bila field ini tidak dikirim, dipakai "profil" — perilaku lama sebelum
 * pemisahan folder, supaya klien yang masih ter-cache tidak salah lokasi.
 */
export const POST = handler(async (req: Request) => {
  const sesi = await wajibRole('admin', 'guru', 'siswa')

  const form = await req.formData()

  const diminta = form.get('jenis')
  if (typeof diminta === 'string' && diminta !== '' && diminta !== 'profil' && diminta !== 'kegiatan') {
    return gagal('Jenis upload tidak dikenal. Gunakan "profil" atau "kegiatan".', 400)
  }

  // Orang tua hanya boleh menulis foto profil anaknya — jangan sampai ada
  // jalur dari akun siswa yang bisa menaruh berkas di folder foto kegiatan.
  const jenis: FolderUpload = sesi.role !== 'siswa' && diminta === 'kegiatan' ? 'kegiatan' : 'profil'

  const entries = form.getAll('files').filter((f): f is File => f instanceof File)

  if (entries.length === 0) return gagal('Tidak ada berkas yang diunggah.', 400)
  if (entries.length > MAKS_BERKAS) {
    return gagal(`Maksimal ${MAKS_BERKAS} berkas sekaligus.`, 400)
  }

  let total = 0
  for (const f of entries) {
    if (!TIPE_DIIZINKAN.includes(f.type)) {
      return gagal(`Format berkas "${f.name}" tidak didukung. Gunakan JPG, PNG atau WEBP.`, 415)
    }
    if (f.size > MAKS_PER_FILE) {
      return gagal(`Berkas "${f.name}" melebihi 3MB.`, 413)
    }
    total += f.size
  }
  if (total > MAKS_TOTAL) return gagal('Ukuran total berkas melebihi 8MB.', 413)

  const urls = await Promise.all(
    entries.map(async (f) => {
      const buffer = Buffer.from(await f.arrayBuffer())
      const hasil = await uploadBuffer(buffer, f.type, namaAman(f.name), jenis)
      return hasil.url
    }),
  )

  return ok({ urls })
})

function namaAman(nama: string): string {
  return nama.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
}