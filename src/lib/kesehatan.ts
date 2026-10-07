import 'server-only'
import { google, type drive_v3 } from 'googleapis'
import { Readable } from 'node:stream'
import { getSheets, spreadsheetId, driveFolderId, type FolderUpload } from './google'
import { REDIRECT_URI } from './oauth'
import { dihubungkanPada, pastikanTokenDimuat, refreshTokenAktif } from './oauth-token'
import { listPengaturan, setPengaturan } from './sheets'
import type { HasilUjiTulis, StatusDrive, StatusKoneksi, StatusSheets } from './types'

// Tipe dipinjam dari ./types (bukan didefinisikan di sini) supaya komponen
// client boleh memakainya tanpa menyentuh modul server-only ini.
export type { HasilUjiTulis, StatusDrive, StatusKoneksi, StatusSheets }

/* ---------------------------------------------------------------------------
 * Cek kesehatan koneksi Google.
 *
 * Dua koneksi dipakai aplikasi dan keduanya bisa putus dengan cara berbeda:
 *
 *  1. SHEETS — Service Account. Token-nya diperbarui otomatis dari private key,
 *     jadi praktis tidak pernah kedaluwarsa. Yang bisa memutusnya: key dihapus,
 *     spreadsheet tidak lagi dibagikan ke email SA, atau ID spreadsheet salah.
 *
 *  2. DRIVE (upload foto) — OAuth akun pemilik. Ini yang rapuh: refresh token
 *     bisa dicabut pengguna, ATAU mati sendiri setelah 7 hari bila OAuth
 *     consent screen masih berstatus "Testing" di Google Cloud Console. Selama
 *     app belum dipublikasikan, koneksi ini WAJIB dihubungkan ulang berkala.
 *
 * Sengaja TIDAK memakai files.get pada folder tujuan sebagai indikator: scope
 * `drive.file` hanya memberi akses ke berkas yang dibuat aplikasi ini, sehingga
 * folder milik pengguna selalu menjawab "File not found" walau koneksi sehat.
 * Uji yang sah adalah menulis lalu menghapus berkas kecil (lihat ujiTulisDrive).
 * ------------------------------------------------------------------------- */

const PERINTAH = 'npm run oauth:drive'

/** Ringkas pesan error Google agar bisa ditampilkan di UI. */
function pesanRingkas(e: unknown): string {
  const teks = e instanceof Error ? e.message : String(e)
  return teks.replace(/\s+/g, ' ').slice(0, 300)
}

/* ------------------------------- SHEETS --------------------------------- */

export async function cekSheets(): Promise<StatusSheets> {
  try {
    const res = await getSheets().spreadsheets.values.get({
      spreadsheetId: spreadsheetId(),
      range: 'Pengaturan!A1:B1',
    })
    const header = res.data.values?.[0]?.[0] ?? '?'
    return { ok: true, pesan: `Spreadsheet terbaca (kolom pertama: "${header}").` }
  } catch (e) {
    return { ok: false, pesan: pesanRingkas(e) }
  }
}

/* -------------------------------- OAUTH --------------------------------- */

async function buatOAuthDariEnv() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  // refreshTokenAktif() membaca token hasil "Hubungkan Ulang Drive" (memori proses)
  // lalu token di spreadsheet, baru nilai .env.local — lihat ./oauth-token.ts.
  await pastikanTokenDimuat()
  const refreshToken = refreshTokenAktif()

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / refresh token belum lengkap. ' +
        'Klik "Hubungkan Ulang Drive", atau isi ketiganya di .env.local / Environment Variables.',
    )
  }

  const oauth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)
  oauth.setCredentials({ refresh_token: refreshToken })
  return oauth
}

/**
 * Baca penanda "app Google sudah dipublikasikan".
 *
 * Google TIDAK menyediakan cara membaca status publishing OAuth consent screen
 * lewat API, jadi ini murni catatan admin (di sheet Pengaturan). Fungsinya
 * hanya satu: berhenti menampilkan peringatan 7 hari setelah publikasi selesai.
 */
export async function sudahDipublikasikan(): Promise<boolean> {
  try {
    const p = await listPengaturan()
    return (p.drive_dipublikasikan ?? '').toUpperCase() === 'YA'
  } catch {
    // Pengaturan gagal dibaca — anggap belum ditandai, jangan sampai cek Drive
    // ikut gagal hanya karena ini.
    return false
  }
}

/** Simpan penanda publikasi dari panel admin. */
export async function tandaiDipublikasikan(dipublikasikan: boolean): Promise<void> {
  await setPengaturan({ drive_dipublikasikan: dipublikasikan ? 'YA' : 'TIDAK' })
}

export async function cekDrive(): Promise<StatusDrive> {
  // Token bisa tersimpan di spreadsheet (Vercel) — muat dulu supaya umur token
  // dan keputusan PUTUS/TERHUBUNG memakai nilai yang sebenarnya.
  await pastikanTokenDimuat()
  const dibuatPada = dihubungkanPada() ?? null
  const umurTokenHari = dibuatPada
    ? Math.round(((Date.now() - new Date(dibuatPada).getTime()) / 86_400_000) * 10) / 10
    : null
  const dipublikasikan = await sudahDipublikasikan()

  const dasar = {
    akun: '',
    dibuatPada,
    umurTokenHari,
    dipublikasikan,
    // Peringatan hanya relevan selama app masih "Testing".
    mendekatiKedaluwarsa: !dipublikasikan && umurTokenHari !== null && umurTokenHari > 5,
  }

  try {
    const oauth = await buatOAuthDariEnv()
    await oauth.getAccessToken()

    const about = await google.drive({ version: 'v3', auth: oauth }).about.get({
      fields: 'user(emailAddress)',
    })

    return {
      ...dasar,
      ok: true,
      akun: about.data.user?.emailAddress ?? '',
      pesan: dipublikasikan
        ? 'Refresh token aktif dan permanen — app Google sudah berstatus "In production".'
        : 'Refresh token aktif. Access token diperbarui otomatis setiap ±1 jam.',
    }
  } catch (e) {
    const pesan = pesanRingkas(e)
    const dicabut = /invalid_grant/i.test(pesan)
    return {
      ...dasar,
      ok: false,
      pesan: dicabut
        ? 'Refresh token sudah tidak berlaku (invalid_grant) — biasanya karena dicabut atau karena app masih berstatus "Testing" lebih dari 7 hari.'
        : pesan,
    }
  }
}

/* --------------------------- UJI TULIS NYATA ----------------------------- */

const LABEL_FOLDER: Record<FolderUpload, string> = {
  profil: 'FOTO PROFIL',
  kegiatan: 'FOTO KEGIATAN',
}

/**
 * Uji sebenarnya jalur upload: buat berkas kecil di folder tujuan lalu hapus.
 *
 * Ini satu-satunya cara memastikan koneksi Drive benar-benar siap menerima
 * foto, karena scope `drive.file` tidak mengizinkan kita membaca folder tujuan.
 * Selalu menghapus berkas ujinya sendiri supaya Drive tidak kotor.
 */
export async function ujiTulisDrive(): Promise<HasilUjiTulis> {
  let drive: drive_v3.Drive
  try {
    drive = google.drive({ version: 'v3', auth: await buatOAuthDariEnv() })
  } catch (e) {
    return { ok: false, rincian: [{ folder: '-', tulis: false, hapus: false, pesan: pesanRingkas(e) }] }
  }

  const rincian: HasilUjiTulis['rincian'] = []

  for (const jenis of Object.keys(LABEL_FOLDER) as FolderUpload[]) {
    const folder = LABEL_FOLDER[jenis]
    let fileId = ''
    let tulis = false
    let hapus = false
    let pesan = ''

    try {
      const dibuat = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name: `.uji-koneksi-erapor-${Date.now()}.txt`,
          mimeType: 'text/plain',
          parents: [driveFolderId(jenis)],
        },
        media: { mimeType: 'text/plain', body: Readable.from(Buffer.from('uji koneksi')) },
        fields: 'id',
      })
      fileId = dibuat.data.id ?? ''
      tulis = Boolean(fileId)
      pesan = 'Berhasil menulis berkas uji.'
    } catch (e) {
      pesan = pesanRingkas(e)
    }

    if (fileId) {
      try {
        await drive.files.delete({ fileId, supportsAllDrives: true })
        hapus = true
        pesan = 'Tulis & hapus berhasil.'
      } catch (e) {
        pesan = `Berkas uji tertulis tetapi gagal dihapus: ${pesanRingkas(e)}`
      }
    }

    rincian.push({ folder, tulis, hapus, pesan })
  }

  return { ok: rincian.every((r) => r.tulis && r.hapus), rincian }
}

/* ------------------------------- GABUNGAN -------------------------------- */

/** Cache pendek supaya membuka halaman tidak memanggil Google berulang kali. */
const TTL_STATUS_MS = 60_000
let cacheStatus: { nilai: StatusKoneksi; kedaluwarsa: number } | null = null

export async function statusKoneksi(paksa = false): Promise<StatusKoneksi> {
  if (!paksa && cacheStatus && cacheStatus.kedaluwarsa > Date.now()) return cacheStatus.nilai

  const [sheets, drive] = await Promise.all([cekSheets(), cekDrive()])
  const nilai: StatusKoneksi = {
    diperiksaPada: new Date().toISOString(),
    sheets,
    drive,
    perintahHubungkanUlang: PERINTAH,
  }

  cacheStatus = { nilai, kedaluwarsa: Date.now() + TTL_STATUS_MS }
  return nilai
}

export function invalidasiStatusKoneksi(): void {
  cacheStatus = null
}
