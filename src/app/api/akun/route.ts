import { handler, ok, gagal } from '@/lib/api'
import {
  listAkun,
  hapusAkun,
  updateUsername,
  updateNamaAkun,
  updatePasswordHash,
} from '@/lib/sheets'
import { tambahAkunManual, generateAkunMassal } from '@/lib/auth'
import { wajibRole } from '@/lib/session'
import { hashPassword } from '@/lib/password'
import { akunSchema, roleSchema } from '@/lib/validate'
import { SANDI_AWAL } from '@/lib/constants'
import { z } from 'zod'
import { str } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Daftar akun.
 *
 * PENTING: kolom password TIDAK PERNAH dikirim ke browser. Yang dikirim hanya
 * status "sudah terhash atau belum". Di aplikasi lama password polos ikut
 * terkirim dan bisa dibaca siapa pun lewat DevTools.
 */
export const GET = handler(async () => {
  await wajibRole('admin')
  return ok(await listAkun())
})

export const POST = handler(async (req: Request) => {
  await wajibRole('admin')
  const body = akunSchema.parse(await req.json())
  await tambahAkunManual({
    role: body.role,
    username: body.username,
    password: body.password,
    nama: body.nama,
  })
  return ok({ ok: true })
})

const aksiSchema = z.object({
  aksi: z.enum(['reset-password', 'ubah-username', 'ubah-nama', 'hapus', 'generate']),
  // Boleh kosong: aksi "generate" tidak memakai username. Aksi lain yang
  // membutuhkannya memeriksa sendiri di bawah supaya pesan errornya jelas
  // (bukan "Too small: expected string to have >=1 characters").
  username: z.string().trim().default(''),
  // Dibutuhkan sesuai aksi
  passwordBaru: z.string().optional(),
  usernameBaru: z.string().trim().optional(),
  namaBaru: z.string().trim().optional(),
  role: roleSchema.optional(),
})

export const PATCH = handler(async (req: Request) => {
  await wajibRole('admin')
  const body = aksiSchema.parse(await req.json())
  const username = str(body.username)

  switch (body.aksi) {
    case 'reset-password': {
      if (!username) return gagal('Username wajib diisi.', 422)
      const pw = body.passwordBaru ?? ''
      if (pw.length < 8) return gagal('Kata sandi minimal 8 karakter.', 422)
      const okUpdate = await updatePasswordHash(username, await hashPassword(pw))
      if (!okUpdate) return gagal('Username tidak ditemukan.', 404)
      return ok({ ok: true })
    }

    case 'ubah-username': {
      if (!username) return gagal('Username wajib diisi.', 422)
      const baru = str(body.usernameBaru)
      if (!baru) return gagal('Username baru wajib diisi.', 422)
      await updateUsername(username, baru)
      return ok({ ok: true })
    }

    case 'ubah-nama': {
      if (!username) return gagal('Username wajib diisi.', 422)
      const nama = str(body.namaBaru)
      if (!nama) return gagal('Nama wajib diisi.', 422)
      await updateNamaAkun(username, nama)
      return ok({ ok: true })
    }

    case 'hapus': {
      if (!username) return gagal('Username wajib diisi.', 422)
      const session = await wajibRole('admin')
      if (session.username === username) {
        return gagal('Anda tidak bisa menghapus akun yang sedang dipakai.', 400)
      }
      await hapusAkun(username)
      return ok({ ok: true })
    }

    case 'generate': {
      // Akun admin tidak pernah digenerate massal — hanya guru & siswa.
      const role = body.role === 'guru' ? 'guru' : 'siswa'
      const jumlah = await generateAkunMassal(role, SANDI_AWAL[role])
      return ok({ ok: true, jumlah })
    }
  }
})