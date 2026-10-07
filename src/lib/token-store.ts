import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { bacaPengaturanRahasia, setPengaturan } from './sheets'

/* ---------------------------------------------------------------------------
 * Penyimpan refresh token Drive yang BERLAKU DI PRODUKSI.
 *
 * Kenapa perlu modul terpisah?
 *  - Di lokal, token cukup disimpan di .env.local. Di Vercel berkas itu tidak ada
 *    dan filesystem-nya hanya-baca, sehingga tulis .env.local selalu gagal dan
 *    nilai globalThis hanya hidup di SATU instance serverless. Akibatnya tombol
 *    "Hubungkan Ulang Drive" akan tampak berhasil padahal token hilang begitu
 *    request berikutnya dilayani instance lain.
 *  - Karena itu token disimpan di Google Spreadsheet (baris rahasia di sheet
 *    Pengaturan). Spreadsheet sudah jadi sumber data aplikasi ini, hanya dibagikan
 *    ke Service Account + pemilik, dan aksesnya memakai Service Account — jadi
 *    tidak bergantung pada token OAuth itu sendiri (tidak ada masalah ayam-telur).
 *
 * Isi baris dienkripsi AES-256-GCM dengan kunci turunan SESSION_SECRET, supaya
 * nilai di spreadsheet (termasuk riwayat versi Google Sheets) tetap tidak berguna
 * tanpa rahasia aplikasi.
 * ------------------------------------------------------------------------- */

const KUNCI_TOKEN = '_oauth_refresh_token'
const KUNCI_WAKTU = '_oauth_connected_at'

/** Umur cache token di memori. Pendek, supaya token baru cepat terpakai. */
const TTL_CACHE_MS = 60_000

interface TokenTersimpan {
  token: string
  connectedAt: string | null
}

declare global {
  var __eraporTokenStore:
    | {
        nilai: TokenTersimpan | null
        kedaluwarsa: number
        /** true bila sheet sudah pernah dibaca (walau hasilnya kosong). */
        sudahDimuat: boolean
      }
    | undefined
}

function store() {
  if (!globalThis.__eraporTokenStore) {
    globalThis.__eraporTokenStore = { nilai: null, kedaluwarsa: 0, sudahDimuat: false }
  }
  return globalThis.__eraporTokenStore
}

/* ------------------------------- Enkripsi -------------------------------- */

function kunciEnkripsi(): Buffer {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET belum diisi atau terlalu pendek (minimal 32 karakter). ' +
        'Token Drive tidak bisa disimpan aman tanpa kunci ini.',
    )
  }
  return createHash('sha256').update(`erapor-oauth-token:${secret}`).digest()
}

/** Bungkus teks jadi nilai yang aman disimpan di sel spreadsheet. */
export function enkripsiToken(teks: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', kunciEnkripsi(), iv)
  const isi = Buffer.concat([cipher.update(teks, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    isi.toString('base64url'),
  ].join('.')
}

/** Balikkan hasil enkripsiToken; null bila blob rusak / kunci berbeda. */
export function dekripsiToken(blob: string): string | null {
  const [versi, iv, tag, isi] = blob.split('.')
  if (versi !== 'v1' || !iv || !tag || !isi) return null

  try {
    const decipher = createDecipheriv('aes-256-gcm', kunciEnkripsi(), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    const teks = Buffer.concat([decipher.update(Buffer.from(isi, 'base64url')), decipher.final()])
    return teks.toString('utf8')
  } catch {
    return null
  }
}

/* ------------------------------ Baca & tulis ----------------------------- */

/** Nilai di memori, tanpa memanggil Google. Dipakai jalur yang harus sinkron. */
export function tokenTersimpan(): TokenTersimpan | null {
  return store().nilai
}

/**
 * Muat token dari spreadsheet (hasilnya di-cache TTL_CACHE_MS).
 *
 * Aman dipanggil berkali-kali: setelah sekali berhasil, pemanggilan berikutnya
 * hanya membaca memori. Bila gagal (mis. kredensial Google bermasalah), token
 * lama di memori tidak dibuang dan `undefined` dikembalikan.
 */
export async function muatTokenTersimpan(paksa = false): Promise<TokenTersimpan | null> {
  const s = store()
  if (!paksa && s.sudahDimuat && s.kedaluwarsa > Date.now()) return s.nilai

  try {
    const [terenkripsi, waktu] = await Promise.all([
      bacaPengaturanRahasia(KUNCI_TOKEN),
      bacaPengaturanRahasia(KUNCI_WAKTU),
    ])

    const token = terenkripsi ? dekripsiToken(terenkripsi) : null
    if (terenkripsi && !token) {
      // Blob ada tetapi tidak bisa dibuka — biasanya SESSION_SECRET berubah.
      // Jangan sampai token lama di memori dipakai terus tanpa diketahui.
      console.warn(
        '[token-store] baris token di spreadsheet tidak bisa dibuka (SESSION_SECRET berbeda?).',
      )
    }

    s.nilai = token ? { token, connectedAt: waktu } : null
    s.kedaluwarsa = Date.now() + TTL_CACHE_MS
    s.sudahDimuat = true
    return s.nilai
  } catch (e) {
    console.warn('[token-store] gagal membaca token dari spreadsheet:', (e as Error).message)
    return s.nilai
  }
}

/**
 * Simpan refresh token ke spreadsheet (permanen) + perbarui memori.
 * Melempar error bila penulisan gagal — pemanggil yang menentukan pesannya.
 */
export async function simpanTokenTersimpan(
  refreshToken: string,
  connectedAt: string,
): Promise<void> {
  await setPengaturan({
    [KUNCI_TOKEN]: enkripsiToken(refreshToken),
    [KUNCI_WAKTU]: connectedAt,
  })
  const s = store()
  s.nilai = { token: refreshToken, connectedAt }
  s.kedaluwarsa = Date.now() + TTL_CACHE_MS
  s.sudahDimuat = true
}

/** Tandai memori agar segera dibaca ulang dari spreadsheet pada panggilan berikutnya. */
export function invalidasiTokenTersimpan(): void {
  const s = store()
  s.kedaluwarsa = 0
  s.sudahDimuat = false
}
