import { handler, ok } from '@/lib/api'
import { wajibRole } from '@/lib/session'
import { statusKoneksi, invalidasiStatusKoneksi, ujiTulisDrive } from '@/lib/kesehatan'

export const dynamic = 'force-dynamic'
// Vercel: panggilan ke Google (unggah foto, tulis sheet) bisa lebih lambat dari
// batas bawaan 10 detik pada cold start.
export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * Status koneksi ringan (tanpa menulis apa pun ke Drive).
 * Tambahkan ?paksa=1 untuk mengabaikan cache 60 detik.
 */
export const GET = handler(async (req: Request) => {
  await wajibRole('admin')
  const paksa = new URL(req.url).searchParams.get('paksa') === '1'
  return ok(await statusKoneksi(paksa))
})

/**
 * Uji unggah sungguhan: tulis berkas kecil ke folder FOTO PROFIL dan FOTO
 * KEGIATAN lalu langsung menghapusnya. Dipakai tombol "Uji unggah foto".
 */
export const POST = handler(async () => {
  await wajibRole('admin')
  invalidasiStatusKoneksi()
  const uji = await ujiTulisDrive()
  return ok({ uji, status: await statusKoneksi(true) })
})
