import 'server-only'
import {
  listSiswa,
  listGuru,
  cariAkunByUsername,
  simpanHashBaru,
  listAkun,
  tambahAkun,
  akunExists,
} from './sheets'
import { hashPassword, verifyPassword, sudahTerhash, MIN_PASSWORD_LENGTH } from './password'
import { buatSession } from './session'
import { SANDI_AWAL } from './constants'
import { str } from './utils'
import type { Role, SessionPayload } from './types'

/* ---------------------------------------------------------------------------
 * Layanan login.
 *
 * Migrasi lazy: aplikasi lama menyimpan password polos di kolom C. Bila kolom
 * PasswordHash (F) masih kosong, kita verifikasi dengan password polos, lalu
 * TEPAT SEKALI tulis hash aslinya dan samarkan kolom C. User tidak perlu
 * mengganti password-nya.
 * ------------------------------------------------------------------------- */

export type HasilLogin =
  | { ok: true; session: SessionPayload }
  | { ok: false; message: string }

const PESAN_GAGAL = 'Username atau Kata Sandi salah!'

export async function login(
  role: Role,
  username: string,
  password: string,
): Promise<HasilLogin> {
  const usernameBersih = str(username)
  const passwordBersih = str(password)

  if (!usernameBersih || !passwordBersih) {
    return { ok: false, message: 'Mohon isi username dan kata sandi.' }
  }

  const ketemu = await cariAkunByUsername(usernameBersih, role)
  if (!ketemu) return { ok: false, message: PESAN_GAGAL }

  const { akun, rowNumber, passwordHash, passwordLama } = ketemu

  let sah = false

  if (sudahTerhash(passwordHash)) {
    sah = await verifyPassword(passwordBersih, passwordHash)
  } else {
    // Password lama polos — bandingkan apa adanya.
    sah = passwordLama === passwordBersih && passwordLama !== '' && passwordLama !== '•'
    if (sah) {
      const baru = await hashPassword(passwordBersih)
      await simpanHashBaru(rowNumber, baru)
    }
  }

  if (!sah) return { ok: false, message: PESAN_GAGAL }

  const foto = await cariFotoProfil(akun.role, akun.idAsli)

  const session: SessionPayload = {
    role: akun.role,
    username: akun.username,
    idAsli: akun.idAsli,
    namaLengkap: akun.namaLengkap,
    foto,
  }

  await buatSession(session)
  return { ok: true, session }
}

async function cariFotoProfil(role: Role, idAsli: string): Promise<string> {
  if (role === 'guru') {
    const guru = (await listGuru()).find((g) => g.nip === idAsli)
    return guru?.foto ?? ''
  }
  if (role === 'siswa') {
    const siswa = (await listSiswa()).find((s) => s.nis === idAsli)
    return siswa?.foto ?? ''
  }
  return ''
}

/** Halaman beranda tiap role. */
export function berandaUntuk(role: Role): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'guru':
      return '/guru'
    case 'siswa':
      return '/ortu'
  }
}

/* ---------------------------------------------------------------------------
 * Manajemen akun (khusus admin).
 * ------------------------------------------------------------------------- */

export async function generateAkunMassal(
  role: 'guru' | 'siswa',
  passwordDefault: string,
): Promise<number> {
  const [akunTersedia, siswa, guru] = await Promise.all([listAkun(), listSiswa(), listGuru()])

  const sudahPunya = new Set(akunTersedia.map((a) => a.idAsli))
  const sumber = role === 'guru' ? guru : siswa
  const hash = await hashPassword(passwordDefault)

  const baru = sumber
    .filter((s) => {
      const id = role === 'guru' ? (s as { nip: string }).nip : (s as { nis: string }).nis
      return id && !sudahPunya.has(id)
    })
    .map((s) => {
      const id = role === 'guru' ? (s as { nip: string }).nip : (s as { nis: string }).nis
      const nama = s.nama
      return { role, username: id, passwordHash: hash, idAsli: id, nama }
    })

  if (baru.length === 0) return 0

  await Promise.all(
    baru.map((a) =>
      tambahAkun({
        role: a.role,
        username: a.username,
        passwordHash: a.passwordHash,
        idAsli: a.idAsli,
        nama: a.nama,
      }),
    ),
  )

  return baru.length
}

/* ---------------------------------------------------------------------------
 * Akun otomatis untuk data guru / siswa.
 * ------------------------------------------------------------------------- */

export interface HasilAkunOtomatis {
  username: string
  /** false bila akun tidak jadi dibuat (mis. username sudah dipakai). */
  dibuat: boolean
  /** Sandi awal yang dipakai bila pengguna tidak menentukan sendiri. */
  sandiAwal: string | null
  alasan?: string
}

/**
 * Buat akun login untuk seorang guru / siswa yang baru ditambahkan.
 *
 * Username default = NIP/NIS, sandi default = SANDI_AWAL per peran. Keduanya
 * bisa ditimpa dari form Tambah Guru / Tambah Siswa. Kalau username sudah
 * terpakai, akun tidak dibuat dan alasannya dikembalikan — bukan error, supaya
 * data guru/siswa-nya tetap tersimpan.
 */
export async function buatAkunUntukData(input: {
  role: 'guru' | 'siswa'
  idAsli: string
  nama: string
  username?: string
  password?: string
}): Promise<HasilAkunOtomatis> {
  const username = str(input.username) || input.idAsli
  const sandiDitentukan = (input.password ?? '').trim()
  const password = sandiDitentukan || SANDI_AWAL[input.role]

  if (await akunExists(username)) {
    return { username, dibuat: false, sandiAwal: null, alasan: 'Username sudah terdaftar.' }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      username,
      dibuat: false,
      sandiAwal: null,
      alasan: `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`,
    }
  }

  await tambahAkun({
    role: input.role,
    username,
    passwordHash: await hashPassword(password),
    idAsli: input.idAsli,
    nama: str(input.nama) || (input.role === 'guru' ? 'Guru' : 'Orang Tua/Siswa'),
  })

  return { username, dibuat: true, sandiAwal: sandiDitentukan ? null : password }
}

export async function tambahAkunManual(input: {
  role: Role
  username: string
  password: string
  nama?: string
}): Promise<void> {
  if (!['admin', 'guru', 'siswa'].includes(input.role)) {
    throw new Error('Role tidak valid.')
  }
  const username = str(input.username)
  if (!username) throw new Error('Username wajib diisi.')
  if (input.password.length < 8) {
    throw new Error('Kata sandi minimal 8 karakter.')
  }
  if (await akunExists(username)) {
    throw new Error('Username sudah terdaftar. Gunakan username lain.')
  }

  await tambahAkun({
    role: input.role,
    username,
    passwordHash: await hashPassword(input.password),
    idAsli: username,
    nama: str(input.nama) || 'Tambahan Manual',
  })
}