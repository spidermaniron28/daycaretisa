import { handler, ok, gagal } from '@/lib/api'
import { laporanById, setStatusNotifikasi, guruByNip, siswaByNis } from '@/lib/sheets'
import { wajibRole } from '@/lib/session'
import { kirimNotifikasiEmail } from '@/lib/notify'

export const dynamic = 'force-dynamic'

/** POST /api/notifikasi/email { id } → kirim ulang email ringkasan ke orang tua. */
export const POST = handler(async (req: Request) => {
  const session = await wajibRole('admin', 'guru')
  const { id } = (await req.json()) as { id?: string }
  if (!id) return gagal('ID laporan wajib diisi.', 422)

  const ketemu = await laporanById(id)
  if (!ketemu) return gagal('Laporan tidak ditemukan.', 404)

  if (session.role === 'guru' && ketemu.laporan.guruNip !== session.idAsli) {
    return gagal('Anda hanya bisa mengirim notifikasi laporan Anda sendiri.', 403)
  }

  const [guru, siswa] = await Promise.all([
    guruByNip(ketemu.laporan.guruNip),
    siswaByNis(ketemu.laporan.nis),
  ])

  const hasil = await kirimNotifikasiEmail(ketemu.laporan, guru, siswa)
  await setStatusNotifikasi(ketemu.laporan.id, hasil.terkirim ? 'TERKIRIM' : 'GAGAL')

  return ok(hasil, hasil.terkirim ? 200 : 502)
})