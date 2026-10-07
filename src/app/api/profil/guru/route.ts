import { handler, ok } from '@/lib/api'
import { updateGuru, updateFotoGuru, guruByNip, tambahGuru } from '@/lib/sheets'
import { buatSession, wajibRole } from '@/lib/session'
import { profilGuruSchema } from '@/lib/validate'

export const dynamic = 'force-dynamic'

/** Guru hanya boleh mengubah profil miliknya sendiri. */
export const PATCH = handler(async (req: Request) => {
  const session = await wajibRole('guru')

  // req.json() hanya boleh dipanggil sekali — body reader hanya bisa dibaca satu kali.
  const mentah = (await req.json()) as Record<string, unknown>
  const body = profilGuruSchema.parse({ nip: session.idAsli, ...mentah })
  const fotoUrl = typeof mentah.fotoUrl === 'string' ? mentah.fotoUrl : ''

  // Data guru boleh belum ada di sheet (mis. akun dibuat manual) — buat baru.
  const ada = await guruByNip(session.idAsli)
  if (ada) {
    await updateGuru(session.idAsli, {
      nip: session.idAsli,
      nama: body.nama,
      mapel: body.mapel,
      nohp: body.nohp,
    })
  } else {
    await tambahGuru({ nip: session.idAsli, nama: body.nama, mapel: body.mapel, nohp: body.nohp })
  }

  if (fotoUrl) {
    await updateFotoGuru(session.idAsli, fotoUrl)

    // Foto di sidebar/header dibaca dari isi cookie session, bukan dari sheet.
    // Tanpa menulis ulang cookie di sini, avatar tetap menampilkan inisial
    // sampai user logout & login lagi. router.refresh() di klien akan membaca
    // cookie baru ini dan langsung menampilkan foto.
    await buatSession({ ...session, foto: fotoUrl })
  }

  return ok({ ok: true })
})