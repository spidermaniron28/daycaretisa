import { handler, ok } from '@/lib/api'
import { updateGuru, hapusGuru, hapusAkunByIdAsli } from '@/lib/sheets'
import { wajibRole } from '@/lib/session'
import { guruSchema } from '@/lib/validate'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ nip: string }>
}

export const PATCH = handler(async (req: Request, { params }: Params) => {
  await wajibRole('admin')
  const { nip: nipLamaParam } = await params
  const nipLama = decodeURIComponent(nipLamaParam)
  const body = guruSchema.parse(await req.json())

  // NIP dibuat otomatis dan tidak boleh berpindah saat data diubah: kalau NIP
  // bisa diganti manual, penomoran jadi bolong atau bertabrakan. Identitas
  // guru tetap memakai NIP lama; kolom lain tetap bisa diedit.
  await updateGuru(nipLama, {
    nip: nipLama,
    nama: body.nama,
    mapel: body.mapel,
    nohp: body.nohp,
    email: body.email,
  })
  return ok({ ok: true, nip: nipLama })
})

export const DELETE = handler(async (_req: Request, { params }: Params) => {
  await wajibRole('admin')
  const { nip } = await params
  const nipBersih = decodeURIComponent(nip)

  await hapusGuru(nipBersih)
  // Akun login ikut dihapus supaya NIP ini bisa dipakai ulang tanpa bentrok
  // username saat guru baru dibuat dengan nomor yang sama.
  await hapusAkunByIdAsli(nipBersih)
  return ok({ ok: true })
})