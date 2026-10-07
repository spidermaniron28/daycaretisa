import { handler, ok } from '@/lib/api'
import {
  listLaporanGuru,
  listLaporanSiswa,
  simpanLaporan,
  updateLaporan,
  laporanById,
  setStatusNotifikasi,
  guruByNip,
  siswaByNis,
} from '@/lib/sheets'
import { wajibRole } from '@/lib/session'
import { laporanSchema } from '@/lib/validate'
import { kirimNotifikasiEmail } from '@/lib/notify'
import { uuid } from '@/lib/utils'
import type { DataLaporan } from '@/lib/types'

export const dynamic = 'force-dynamic'
// Vercel: panggilan ke Google (unggah foto, tulis sheet) bisa lebih lambat dari
// batas bawaan 10 detik pada cold start.
export const maxDuration = 60

/**
 * GET /api/laporan?nis=2526001  → laporan seorang anak (untuk orang tua)
 * GET /api/laporan             → laporan milik guru yang sedang login
 */
export const GET = handler(async (req: Request) => {
  const session = await wajibRole('admin', 'guru', 'siswa')
  const nis = new URL(req.url).searchParams.get('nis')

  if (nis) {
    // Orang tua hanya boleh melihat laporan anaknya sendiri.
    if (session.role === 'siswa' && session.idAsli !== nis) {
      return ok({ error: 'Anda hanya bisa melihat laporan anak Anda sendiri.' }, 403)
    }
    return ok(await listLaporanSiswa(nis))
  }

  if (session.role === 'siswa') return ok(await listLaporanSiswa(session.idAsli))
  if (session.role === 'admin') return ok([])

  return ok(await listLaporanGuru(session.idAsli))
})

export const POST = handler(async (req: Request) => {
  const session = await wajibRole('admin', 'guru')
  const body = laporanSchema.parse(await req.json())
  const kirimEmail = new URL(req.url).searchParams.get('kirimEmail') === '1'

  // Guru hanya boleh menyimpan laporan atas namanya sendiri.
  const guruNip = session.role === 'admin' ? body.guruNip : session.idAsli
  if (session.role === 'guru' && body.guruNip && body.guruNip !== session.idAsli) {
    return ok({ error: 'Anda tidak boleh menyimpan laporan atas nama guru lain.' }, 403)
  }

  const laporan: DataLaporan = {
    ...body,
    id: body.id || uuid(),
    guruNip,
    dibuat: new Date().toISOString(),
    notifikasi: '',
  }

  if (body.id) {
    // Saat mengedit, pertahankan timestamp pembuatan & status notifikasi lama.
    const sebelumnya = await laporanById(body.id)
    if (!sebelumnya) return ok({ error: 'Laporan tidak ditemukan.' }, 404)
    laporan.dibuat = sebelumnya.laporan.dibuat
    laporan.notifikasi = sebelumnya.laporan.notifikasi
    await updateLaporan(laporan)
  } else {
    await simpanLaporan(laporan)
  }

  // Notifikasi bersifat best-effort: laporan sudah tersimpan di Sheet, jadi
  // kegagalan email tidak boleh membuat pengguna mengulang penyimpanan.
  let notifikasi: { terkirim: boolean; pesan?: string } = { terkirim: false }

  if (kirimEmail) {
    const [guru, siswa] = await Promise.all([guruByNip(guruNip), siswaByNis(laporan.nis)])
    notifikasi = await kirimNotifikasiEmail(laporan, guru, siswa)
    await setStatusNotifikasi(laporan.id, notifikasi.terkirim ? 'TERKIRIM' : 'GAGAL')
  }

  return ok({ ok: true, id: laporan.id, notifikasi })
})