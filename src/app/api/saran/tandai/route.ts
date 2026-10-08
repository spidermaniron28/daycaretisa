import { handler, ok } from '@/lib/api'
import { tandaiSemuaSaranDibaca } from '@/lib/sheets'
import { wajibRole } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * POST /api/saran/tandai → admin menandai semua saran sebagai sudah dibaca,
 * sehingga lencana notifikasi di sidebar ikut hilang.
 */
export const POST = handler(async () => {
  await wajibRole('admin')
  const jumlah = await tandaiSemuaSaranDibaca()
  return ok({ ok: true, jumlah })
})
