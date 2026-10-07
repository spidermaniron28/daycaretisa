import { handler, ok } from '@/lib/api'
import { listSiswa, tambahSiswa } from '@/lib/sheets'
import { buatAkunUntukData } from '@/lib/auth'
import { wajibRole } from '@/lib/session'
import { siswaSchema } from '@/lib/validate'
import { nisSiswaBerikutnya } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** Guru boleh melihat data siswa; hanya admin yang boleh menambah. */
export const GET = handler(async () => {
  await wajibRole('admin', 'guru', 'siswa')
  return ok(await listSiswa())
})

export const POST = handler(async (req: Request) => {
  await wajibRole('admin', 'guru')
  const body = siswaSchema.parse(await req.json())

  // NIS selalu ditentukan server, bukan dari klien, supaya penomoran tidak bisa
  // bolong atau bertabrakan. Nomor yang dipakai adalah yang terkecil yang masih
  // kosong — jadi NIS siswa yang sudah dihapus bisa terpakai lagi.
  const nis = nisSiswaBerikutnya((await listSiswa()).map((s) => s.nis))

  await tambahSiswa({
    nis,
    nama: body.nama,
    kelas: body.kelas,
    jk: body.jk,
    status: body.status,
    tanggalLahir: body.tanggalLahir,
  })

  // Akun login ortu/siswa dibuat sekalian supaya langsung muncul di menu
  // Akun Pengguna. Username default = NIS, sandi default = SANDI_AWAL.siswa.
  const akun = await buatAkunUntukData({
    role: 'siswa',
    idAsli: nis,
    nama: body.nama,
    username: body.akunUsername,
    password: body.akunPassword,
  })

  return ok({ ok: true, nis, akun })
})