import { handler, ok } from '@/lib/api'
import { listRombel, tambahRombel, hapusRombel } from '@/lib/sheets'
import { wajibRole } from '@/lib/session'
import { rombelSchema } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  await wajibRole('admin', 'guru', 'siswa')
  return ok(await listRombel())
})

export const POST = handler(async (req: Request) => {
  await wajibRole('admin')
  const body = rombelSchema.parse(await req.json())
  await tambahRombel({ kode: body.kode, nama: body.nama, wali: body.wali })
  return ok({ ok: true })
})

export const DELETE = handler(async (req: Request) => {
  await wajibRole('admin')
  const kode = new URL(req.url).searchParams.get('kode')
  if (!kode) return ok({ ok: false }, 400)
  await hapusRombel(kode)
  return ok({ ok: true })
})