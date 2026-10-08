import { handler, ok, gagal } from '@/lib/api'
import { laporanById, updateLaporan, hapusLaporan, siswaByNis } from '@/lib/sheets'
import { wajibRole } from '@/lib/session'
import { laporanSchema } from '@/lib/validate'
import { interpretasiSimpan } from '@/lib/antropometri'

export const dynamic = 'force-dynamic'
// Vercel: panggilan ke Google (unggah foto, tulis sheet) bisa lebih lambat dari
// batas bawaan 10 detik pada cold start.
export const maxDuration = 60

interface Params {
  params: Promise<{ id: string }>
}

export const PATCH = handler(async (req: Request, { params }: Params) => {
  await wajibRole('admin', 'guru')
  const { id } = await params
  const session = await wajibRole('admin', 'guru')

  const sebelumnya = await laporanById(decodeURIComponent(id))
  if (!sebelumnya) return gagal('Laporan tidak ditemukan.', 404)

  if (session.role === 'guru' && sebelumnya.laporan.guruNip !== session.idAsli) {
    return gagal('Anda hanya bisa mengubah laporan yang Anda buat sendiri.', 403)
  }

  const body = laporanSchema.parse(await req.json())

  await updateLaporan({
    ...sebelumnya.laporan,
    ...body,
    // Interpretasi BB/TB dihitung ulang dari tanggal lahir anak (sheet Siswa).
    pertumbuhan: interpretasiSimpan(
      body.pertumbuhan,
      await siswaByNis(body.nis),
      body.tanggal,
    ),
    id: sebelumnya.laporan.id,
    dibuat: sebelumnya.laporan.dibuat,
    guruNip: session.role === 'admin' ? body.guruNip : session.idAsli,
  })

  return ok({ ok: true })
})

export const DELETE = handler(async (_req: Request, { params }: Params) => {
  const session = await wajibRole('admin', 'guru')
  const { id } = await params

  const ada = await laporanById(decodeURIComponent(id))
  if (!ada) return gagal('Laporan tidak ditemukan.', 404)

  if (session.role === 'guru' && ada.laporan.guruNip !== session.idAsli) {
    return gagal('Anda hanya bisa menghapus laporan yang Anda buat sendiri.', 403)
  }

  await hapusLaporan(ada.laporan.id)
  return ok({ ok: true })
})