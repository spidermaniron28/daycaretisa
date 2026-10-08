import { handler, ok } from '@/lib/api'
import { listSaran, listSaranByNis, siswaByNis, tambahSaran } from '@/lib/sheets'
import { wajibRole } from '@/lib/session'
import { saranSchema } from '@/lib/validate'

export const dynamic = 'force-dynamic'

/**
 * GET /api/saran → admin: semua saran; orang tua: saran miliknya sendiri.
 */
export const GET = handler(async () => {
  const session = await wajibRole('admin', 'siswa')
  if (session.role === 'admin') return ok(await listSaran())
  return ok(await listSaranByNis(session.idAsli))
})

/**
 * POST /api/saran { pesan } → orang tua mengirim saran & masukan.
 * Status awal 'BARU' — memicu lencana notifikasi di sidebar admin.
 */
export const POST = handler(async (req: Request) => {
  const session = await wajibRole('siswa')
  const body = saranSchema.parse(await req.json())

  // Nama & kelas diambil dari sheet supaya tetap konsisten dengan data siswa.
  const siswa = await siswaByNis(session.idAsli)
  await tambahSaran({
    nis: session.idAsli,
    nama: siswa?.nama || session.namaLengkap,
    kelas: siswa?.kelas ?? '',
    pesan: body.pesan,
  })

  return ok({ ok: true })
})
