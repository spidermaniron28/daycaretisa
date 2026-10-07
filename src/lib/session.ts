import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { Role, SessionPayload } from './types'

/* ---------------------------------------------------------------------------
 * Session berbasis JWT dalam cookie httpOnly.
 * Cookie httpOnly berarti JavaScript di browser tidak bisa membacanya, sehingga
 * session tidak bisa dicuri lewat XSS.
 * ------------------------------------------------------------------------- */

const COOKIE_NAME = 'erapor_session'

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET belum diisi atau terlalu pendek (minimal 32 karakter). ' +
        'Generate dengan: openssl rand -base64 48',
    )
  }
  return new TextEncoder().encode(secret)
}

function ttlHours(): number {
  const n = Number(process.env.SESSION_TTL_HOURS)
  return Number.isFinite(n) && n > 0 ? n : 8
}

export async function buatSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlHours()}h`)
    .sign(secretKey())

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttlHours() * 60 * 60,
  })
}

export async function hapusSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** Baca session dari cookie. Return null bila tidak ada / kedaluwarsa / rusak. */
export async function bacaSession(): Promise<SessionPayload | null> {
  try {
    const store = await cookies()
    const token = store.get(COOKIE_NAME)?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'],
    })

    const role = payload.role as Role
    if (!['admin', 'guru', 'siswa'].includes(role)) return null

    return {
      role,
      username: String(payload.username ?? ''),
      idAsli: String(payload.idAsli ?? ''),
      namaLengkap: String(payload.namaLengkap ?? ''),
      foto: String(payload.foto ?? ''),
    }
  } catch {
    return null
  }
}

/**
 * Helper untuk route handler & server component: wajib login.
 * Melempar error 401 bila session tidak valid.
 */
export async function wajibSession(): Promise<SessionPayload> {
  const s = await bacaSession()
  if (!s) throw new UnauthorizedError()
  return s
}

/** Wajib login DAN punya role yang diizinkan. */
export async function wajibRole(...roles: Role[]): Promise<SessionPayload> {
  const s = await wajibSession()
  if (!roles.includes(s.role)) throw new ForbiddenError()
  return s
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Sesi tidak valid atau sudah berakhir. Silakan login kembali.')
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Anda tidak punya akses ke bagian ini.')
    this.name = 'ForbiddenError'
  }
}

export { COOKIE_NAME as SESSION_COOKIE }