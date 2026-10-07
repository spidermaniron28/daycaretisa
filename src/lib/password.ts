import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>

/* ---------------------------------------------------------------------------
 * Hashing password dengan scrypt (bawaan Node — tanpa native build, aman di Vercel).
 *
 * Format kolom PasswordHash:
 *   scrypt$N$r$p$<salt-base64>$<hash-base64>
 *
 * Kolom Password (polos) dari aplikasi Apps Script lama dibiarkan ada supaya
 * data lama tidak rusak, tapi tidak lagi dipakai sebagai sumber kebenaran
 * setelah login pertama berhasil — lihat ./auth.ts.
 * ------------------------------------------------------------------------- */

const N = 16384
const r = 8
const p = 1
const KEYLEN = 64
const SALT_BYTES = 16

export const MIN_PASSWORD_LENGTH = 8

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await scrypt(plain.normalize('NFKC'), salt, KEYLEN)
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.trim().split('$')
    if (parts.length !== 6) return false
    const [, , , , saltB64, hashB64] = parts

    const expected = Buffer.from(hashB64, 'base64')
    const derived = await scrypt(
      plain.normalize('NFKC'),
      Buffer.from(saltB64, 'base64'),
      expected.length || KEYLEN,
    )

    // Panjang sama + timingSafeEqual supaya aman terhadap timing leak.
    if (derived.length !== expected.length) return false
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

/** Password dianggap "sudah dimigrasi" bila kolom PasswordHash terisi format di atas. */
export function sudahTerhash(stored: string): boolean {
  return /^scrypt\$\d+\$\d+\$\d+\$/.test(stored.trim())
}