import { handler, ok } from '@/lib/api'
import { updateSiswa, hapusSiswa, hapusAkunByIdAsli } from '@/lib/sheets'
import { wajibRole } from '@/lib/session'
import { siswaSchema } from '@/lib/validate'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ nis: string }>
}

export const PATCH = handler(async (req: Request, { params }: Params) => {
  await wajibRole('admin', 'guru')
  const { nis: nisLamaParam } = await params
  const nisLama = decodeURIComponent(nisLamaParam)
  const body = siswaSchema.parse(await req.json())

  // NIS dibuat otomatis dan tidak boleh berpindah saat data diubah: kalau NIS
  // bisa diganti manual, penomoran jadi bolong atau bertabrakan. Identitas
  // siswa tetap memakai NIS lama; kolom lain tetap bisa diedit.
  await updateSiswa(nisLama, {
    nis: nisLama,
    nama: body.nama,
    kelas: body.kelas,
    jk: body.jk,
    status: body.status,
  })
  return ok({ ok: true, nis: nisLama })
})

export const DELETE = handler(async (_req: Request, { params }: Params) => {
  await wajibRole('admin', 'guru')
  const { nis } = await params
  const nisBersih = decodeURIComponent(nis)

  await hapusSiswa(nisBersih)
  // Akun orang tua ikut dihapus supaya NIS ini bisa dipakai ulang tanpa
  // bentrok username saat siswa baru dibuat dengan nomor yang sama.
  await hapusAkunByIdAsli(nisBersih)
  return ok({ ok: true })
})