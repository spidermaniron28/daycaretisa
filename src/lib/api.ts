import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ForbiddenError, UnauthorizedError } from './session'

/* ---------------------------------------------------------------------------
 * Helper untuk route handler.
 * ------------------------------------------------------------------------- */

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as object, { status })
}

export function gagal(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Ubah error apa pun menjadi JSON yang aman.
 * Error dari Google API sengaja disamarkan supaya detail internal tidak bocor.
 */
export function tanganiError(e: unknown) {
  if (e instanceof UnauthorizedError) return gagal(e.message, 401)
  if (e instanceof ForbiddenError) return gagal(e.message, 403)
  if (e instanceof z.ZodError) {
    const pertama = e.issues[0]
    return gagal(pertama?.message ?? 'Data tidak valid.', 422)
  }

  const pesan = e instanceof Error ? e.message : 'Terjadi kesalahan.'
  console.error('[api]', e)

  // Pesan yang memang aman untuk ditampilkan ke user.
  if (/tidak ditemukan|sudah terdaftar|wajib|minimal|role tidak valid|kelas tidak/i.test(pesan)) {
    return gagal(pesan, 400)
  }
  if (/sudah dipakai/i.test(pesan)) return gagal(pesan, 409)

  return gagal('Terjadi kesalahan di server. Silakan coba lagi.', 500)
}

/** Bungkus handler agar error selalu jadi JSON, bukan stack trace. */
export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args)
    } catch (e) {
      return tanganiError(e)
    }
  }
}