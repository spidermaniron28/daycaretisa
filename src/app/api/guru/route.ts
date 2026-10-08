import { handler, ok } from '@/lib/api'
import { listGuru, tambahGuru } from '@/lib/sheets'
import { buatAkunUntukData } from '@/lib/auth'
import { wajibRole } from '@/lib/session'
import { guruSchema } from '@/lib/validate'
import { nipGuruBerikutnya } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  await wajibRole('admin', 'guru')
  return ok(await listGuru())
})

export const POST = handler(async (req: Request) => {
  await wajibRole('admin')
  const body = guruSchema.parse(await req.json())

  // NIP selalu ditentukan server, bukan dari klien, supaya penomoran tidak
  // bisa bolong atau bertabrakan. Nomor yang dipakai adalah yang terkecil yang
  // masih kosong — jadi NIP guru yang sudah dihapus bisa terpakai lagi.
  const nip = nipGuruBerikutnya((await listGuru()).map((g) => g.nip))

  await tambahGuru({ nip, nama: body.nama, mapel: body.mapel, nohp: body.nohp, email: body.email })

  // Akun login dibuat sekalian supaya guru baru langsung muncul di menu
  // Akun Pengguna. Username default = NIP, sandi default = SANDI_AWAL.guru.
  const akun = await buatAkunUntukData({
    role: 'guru',
    idAsli: nip,
    nama: body.nama,
    username: body.akunUsername,
    password: body.akunPassword,
  })

  return ok({ ok: true, nip, akun })
})