import { z } from 'zod'
import { handler, ok } from '@/lib/api'
import { updateKontakSiswa, updateFotoSiswa, updatePasswordHash, siswaByNis } from '@/lib/sheets'
import { buatSession, wajibRole } from '@/lib/session'
import { MIN_PASSWORD_LENGTH, hashPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

/** Hanya field yang boleh diubah orang tua. NIS & Nama sengaja tidak ada di sini. */
const skema = z.object({
  emailOrtu: z.union([z.email('Format email tidak valid.'), z.literal('')]).default(''),
  noWhatsapp: z.string().trim().max(20).default(''),
  passwordBaru: z
    .union([z.literal(''), z.string().min(MIN_PASSWORD_LENGTH, `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`)])
    .default(''),
  fotoUrl: z.union([z.url(), z.literal('')]).default(''),
})

/**
 * Orang tua hanya boleh mengubah data anaknya sendiri — identitas (NIS & nama)
 * dikunci di server dan sengaja tidak pernah diparse dari request.
 */
export const PATCH = handler(async (req: Request) => {
  const session = await wajibRole('siswa')
  const body = skema.parse(await req.json())

  await updateKontakSiswa(session.idAsli, body.emailOrtu, body.noWhatsapp)

  if (body.fotoUrl) {
    const ada = await siswaByNis(session.idAsli)
    if (!ada) return ok({ error: 'Data anak belum terdaftar di sheet Siswa.' }, 404)
    await updateFotoSiswa(session.idAsli, body.fotoUrl)

    // Sama seperti profil guru: avatar portal dibaca dari cookie session,
    // jadi cookie harus ditulis ulang agar foto baru langsung tampil.
    await buatSession({ ...session, foto: body.fotoUrl })
  }

  if (body.passwordBaru) {
    await updatePasswordHash(session.username, await hashPassword(body.passwordBaru))
  }

  return ok({ ok: true })
})