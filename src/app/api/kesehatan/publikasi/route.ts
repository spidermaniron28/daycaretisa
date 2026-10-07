import { handler, ok } from '@/lib/api'
import { wajibRole } from '@/lib/session'
import { tandaiDipublikasikan, invalidasiStatusKoneksi, statusKoneksi } from '@/lib/kesehatan'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const skema = z.object({ dipublikasikan: z.boolean() })

/**
 * Simpan penanda "app Google sudah dipublikasikan".
 *
 * Hanya ditulis lewat endpoint ini (bukan lewat /api/pengaturan) karena
 * pengaturanSchema diisi nilai bawaan untuk semua kolom — mengirim satu kunci
 * saja lewat sana akan mengosongkan pengaturan lain.
 */
export const POST = handler(async (req: Request) => {
  await wajibRole('admin')
  const { dipublikasikan } = skema.parse(await req.json())

  await tandaiDipublikasikan(dipublikasikan)
  invalidasiStatusKoneksi()

  return ok({ ok: true, status: await statusKoneksi(true) })
})
