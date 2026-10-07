import { handler, ok } from '@/lib/api'
import { listPengaturan, setPengaturan } from '@/lib/sheets'
import { wajibRole } from '@/lib/session'
import { pengaturanSchema } from '@/lib/validate'

export const dynamic = 'force-dynamic'

/** Pengaturan bersifat publik — dipakai halaman login untuk branding. */
export const GET = handler(async () => {
  await wajibRole('admin', 'guru', 'siswa')
  return ok(await listPengaturan())
})

export const PATCH = handler(async (req: Request) => {
  await wajibRole('admin')
  const body = pengaturanSchema.parse(await req.json())
  await setPengaturan({ ...body })
  return ok({ ok: true })
})