import 'server-only'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import {
  invalidasiTokenTersimpan,
  muatTokenTersimpan,
  simpanTokenTersimpan,
  tokenTersimpan,
} from './token-store'

/* ---------------------------------------------------------------------------
 * Token OAuth Drive yang dipakai aplikasi + pengelola alur "Hubungkan Ulang".
 *
 * Sumber token, dari yang paling diutamakan:
 *  1. Hasil consent di PROSES INI (globalThis) — selalu yang paling baru.
 *  2. Baris rahasia di spreadsheet (lihat ./token-store.ts) — ini yang membuat
 *     hubungkan-ulang berfungsi di Vercel, karena .env.local tidak ada di sana
 *     dan memori hanya hidup di satu instance serverless.
 *  3. process.env.GOOGLE_OAUTH_REFRESH_TOKEN — nilai awal / hasil
 *     `npm run oauth:drive` di lokal.
 *
 * Bila (2) dan (3) dua-duanya ada, yang menang adalah yang cap waktunya lebih
 * baru, supaya menjalankan skrip lokal tidak "kalah" dari token lama di sheet.
 *
 * State anti-CSRF dibuat STATELESS (stempel waktu + HMAC SESSION_SECRET), bukan
 * disimpan di memori: di Vercel, request pembuat state dan request callback bisa
 * dilayani instance yang berbeda.
 * ------------------------------------------------------------------------- */

declare global {
  var __eraporOauth: { refreshToken?: string; connectedAt?: string } | undefined
}

const FILE_ENV = '.env.local'
const MASA_BERLAKU_STATE_MS = 15 * 60_000

function store() {
  if (!globalThis.__eraporOauth) globalThis.__eraporOauth = {}
  return globalThis.__eraporOauth
}

function waktu(nilai: string | undefined | null): number | null {
  if (!nilai) return null
  const ms = Date.parse(nilai)
  return Number.isFinite(ms) ? ms : null
}

/** Kandidat token dari ketiga sumber, untuk fungsi pemilihan di bawah. */
export interface KandidatToken {
  /** Hasil consent di proses ini (globalThis). */
  runtime?: { token?: string; connectedAt?: string }
  /** Baris rahasia di spreadsheet. */
  sheet?: { token: string; connectedAt: string | null } | null
  /** process.env (nilai awal / hasil `npm run oauth:drive`). */
  env?: { token?: string; connectedAt?: string }
}

/**
 * Aturan pemilihan token — fungsi murni supaya bisa diuji tanpa jaringan.
 *
 *  1. Token hasil consent di proses ini selalu menang (paling baru).
 *  2. Bila hanya satu sumber punya token, pakai itu.
 *  3. Bila dua-duanya punya: yang cap waktunya lebih baru menang.
 *     - Tanpa cap waktu sama sekali → percaya spreadsheet (itu tulisan aplikasi).
 *     - Cap waktu hanya di env → token itu sengaja diisi manual, jadi dipakai;
 *       inilah yang membuat token hasil salin-tempel di Vercel tetap dihormati.
 *     - Cap waktu hanya di sheet → token hasil tombol Hubungkan Ulang, dipakai.
 */
export function pilihToken(k: KandidatToken): string | undefined {
  if (k.runtime?.token) return k.runtime.token

  const sheet = k.sheet?.token
  const env = k.env?.token
  if (!sheet) return env
  if (!env) return sheet

  const wSheet = waktu(k.sheet?.connectedAt)
  const wEnv = waktu(k.env?.connectedAt)
  if (wSheet === null && wEnv === null) return sheet
  if (wEnv === null) return env
  if (wSheet === null) return sheet
  return wSheet >= wEnv ? sheet : env
}

/** Kapan token yang menang dibuat — untuk menampilkan umurnya di panel. */
export function pilihWaktu(k: KandidatToken): string | undefined {
  if (k.runtime?.token) return k.runtime.connectedAt ?? k.env?.connectedAt

  const menang = pilihToken(k)
  if (!menang) return k.env?.connectedAt ?? k.sheet?.connectedAt ?? undefined
  if (k.sheet?.token === menang) return k.sheet.connectedAt ?? k.env?.connectedAt ?? undefined
  return k.env?.connectedAt ?? k.sheet?.connectedAt ?? undefined
}

/** Kandidat dari keadaan nyata aplikasi saat ini. */
function kandidatSekarang(): KandidatToken {
  return {
    runtime: store(),
    sheet: tokenTersimpan(),
    env: {
      token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      connectedAt: process.env.GOOGLE_OAUTH_CONNECTED_AT,
    },
  }
}

/** Token yang sedang dipakai. Lihat pilihToken() untuk urutan sumbernya. */
export function refreshTokenAktif(): string | undefined {
  return pilihToken(kandidatSekarang())
}

/** Kapan refresh token aktif dibuat (untuk menampilkan umurnya di panel). */
export function dihubungkanPada(): string | undefined {
  return pilihWaktu(kandidatSekarang())
}

/** Muat token dari spreadsheet sekali sebelum dipakai (dipanggil jalur async). */
export async function pastikanTokenDimuat(): Promise<void> {
  await muatTokenTersimpan()
}

export interface HasilSimpanToken {
  /** Tersimpan permanen di spreadsheet — berlaku untuk semua instance Vercel. */
  tersimpanDurable: boolean
  /** Ikut ditulis ke .env.local (hanya mungkin saat dijalankan lokal). */
  envTertulis: boolean
  pesan: string
}

/**
 * Simpan token hasil consent baru.
 *
 * Penyimpanan ke spreadsheet bersifat WAJIB (itu satu-satunya tempat yang
 * bertahan di Vercel); penulisan .env.local hanya kemudahan untuk lokal,
 * jadi kegagalannya tidak dianggap gagal.
 */
export async function simpanTokenBaru(refreshToken: string): Promise<HasilSimpanToken> {
  const waktuIso = new Date().toISOString()
  const s = store()
  s.refreshToken = refreshToken
  s.connectedAt = waktuIso

  let tersimpanDurable = false
  let pesanDurable = ''
  try {
    await simpanTokenTersimpan(refreshToken, waktuIso)
    tersimpanDurable = true
  } catch (e) {
    invalidasiTokenTersimpan()
    pesanDurable =
      `Gagal menyimpan token permanen ke spreadsheet (${(e as Error).message}). ` +
      'Token baru hanya aktif di proses ini sampai server dimatikan — periksa akses Service Account ke spreadsheet.'
  }

  let envTertulis = false
  try {
    let isi = readFileSync(FILE_ENV, 'utf8')
    isi = setVar(isi, 'GOOGLE_OAUTH_REFRESH_TOKEN', refreshToken)
    isi = setVar(isi, 'GOOGLE_OAUTH_CONNECTED_AT', waktuIso)
    writeFileSync(FILE_ENV, isi)
    envTertulis = true
  } catch {
    // Normal di Vercel: filesystem hanya-baca dan .env.local memang tidak ada.
  }

  const pesan = tersimpanDurable
    ? 'Token baru tersimpan permanen dan langsung aktif untuk semua pengguna.'
    : pesanDurable

  return { tersimpanDurable, envTertulis, pesan }
}

/* ------------------------------ State anti-CSRF --------------------------- */

function kunciTandaTangan(): Buffer {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET belum diisi atau terlalu pendek (minimal 32 karakter). ' +
        'Generate dengan: openssl rand -base64 48',
    )
  }
  return createHash('sha256').update(`erapor-oauth-state:${secret}`).digest()
}

function tandaTanganNil(stempel: string): string {
  return createHmac('sha256', kunciTandaTangan()).update(stempel).digest('base64url')
}

/**
 * State sekali jalan: "<stempel waktu>.<hmac>".
 *
 * Tanpa penyimpanan di memori, sehingga tetap sah walau callback dilayani
 * instance server yang berbeda (wajib untuk Vercel). Berlaku 15 menit — sesudah
 * itu dianggap kedaluwarsa.
 */
export function buatState(): string {
  // Stempel waktu + potongan acak, dipisah "-" supaya bisa diurai kembali tanpa
  // menebak panjangnya (Date.now() dalam basis36 bertambah satu digit seiring waktu).
  const stempel = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
  return `${stempel}.${tandaTanganNil(stempel)}`
}

/** true bila state ditandatangani server ini dan belum lebih dari 15 menit. */
export function pakaiState(nilai: string | null): boolean {
  if (!nilai) return false

  const pisah = nilai.indexOf('.')
  if (pisah <= 0) return false

  const stempel = nilai.slice(0, pisah)
  const tanda = nilai.slice(pisah + 1)
  const harapan = tandaTanganNil(stempel)

  // Panjang berbeda → timingSafeEqual melempar, jadi disaring lebih dulu.
  if (tanda.length !== harapan.length) return false
  if (!timingSafeEqual(Buffer.from(tanda), Buffer.from(harapan))) return false

  const ms = parseInt(stempel.split('-')[0], 36)
  if (!Number.isFinite(ms)) return false
  return Date.now() - ms < MASA_BERLAKU_STATE_MS
}

/** Selaras dengan scripts/lib/env-file.ts — timpa satu KEY tanpa merusak baris lain. */
function setVar(isi: string, key: string, value: string): string {
  const pola = new RegExp(`^${key}=.*$`, 'm')
  if (pola.test(isi)) return isi.replace(pola, `${key}=${value}`)
  return `${isi.trimEnd()}\n${key}=${value}\n`
}
