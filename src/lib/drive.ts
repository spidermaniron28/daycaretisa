import 'server-only'
import { Readable } from 'node:stream'
import { getDrive, driveFolderId, type FolderUpload } from './google'
import { getDriveOAuth, kredensialOAuthTerisi } from './oauth'

/* ---------------------------------------------------------------------------
 * Upload ke Google Drive.
 *
 * Tujuan file ditentukan oleh `jenis`:
 *  - 'profil'   → GOOGLE_DRIVE_FOLDER_ID (foto profil, logo, background)
 *  - 'kegiatan' → GOOGLE_DRIVE_FOLDER_KEGIATAN (foto laporan harian)
 * Dua folder berbeda supaya arsip Drive tidak bercampur saat dibuka langsung.
 *
 * Setiap file lalu diberi izin "anyone with link → reader" supaya bisa
 * ditampilkan di <img> tanpa login.
 * ------------------------------------------------------------------------- */

export interface HasilUpload {
  id: string
  url: string
}

const THUMB = (id: string) => `https://drive.google.com/thumbnail?id=${id}&sz=w1200`

export async function uploadBuffer(
  data: Buffer,
  mimeType: string,
  namaFile: string,
  jenis: FolderUpload = 'profil',
): Promise<HasilUpload> {
  // OAuth akun pemilik dipakai bila tersedia — Service Account tidak punya
  // kuota penyimpanan Drive (sejak 2025), jadi files.create selalu 403.
  const pakaiOAuth = await kredensialOAuthTerisi()
  const drive = pakaiOAuth ? await getDriveOAuth() : getDrive()

  const created = await drive.files.create({
    // Dibutuhkan bila folder tujuan berada di shared drive; tidak berpengaruh
    // untuk folder Drive biasa.
    supportsAllDrives: true,
    requestBody: {
      name: namaFile,
      mimeType,
      parents: [driveFolderId(jenis)],
    },
    media: {
      mimeType,
      body: Readable.from(data),
    },
    fields: 'id',
  })

  const id = created.data.id
  if (!id) throw new Error('Gagal membuat file di Google Drive.')

  await paranoidSharing(() =>
    drive.permissions.create({
      supportsAllDrives: true,
      fileId: id,
      sendNotificationEmail: false,
      requestBody: { type: 'anyone', role: 'reader' },
    }),
  )

  return { id, url: THUMB(id) }
}

/** Unggah banyak file sekaligus — default ke folder foto kegiatan. */
export async function uploadBanyak(
  files: Array<{ data: Buffer; mimeType: string; namaFile: string }>,
  jenis: FolderUpload = 'kegiatan',
): Promise<string[]> {
  const hasil: string[] = []
  for (const f of files) {
    const u = await uploadBuffer(f.data, f.mimeType, f.namaFile, jenis)
    hasil.push(u.url)
  }
  return hasil
}

/**
 * Beri izin publik pada file lama yang diunggah aplikasi Apps Script sebelumnya
 * (folder-nya dibuat oleh akun lain, jadi default-nya private).
 */
export async function ensurePublic(fileId: string): Promise<void> {
  await paranoidSharing(() =>
    getDrive().permissions.create({
      supportsAllDrives: true,
      fileId,
      sendNotificationEmail: false,
      requestBody: { type: 'anyone', role: 'reader' },
    }),
  )
}

/** Ekstrak ID file dari URL drive thumbnail /uc?/viewer agar bisa di-share ulang. */
export function idDariUrl(url: string): string | null {
  const m = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)
  return m ? m[1] : null
}

/**
 * Kegagalan berbagi tidak boleh menggagalkan upload — file tetap tersimpan di
 * Drive, hanya saja belum bisa ditampilkan lewat <img>.
 */
async function paranoidSharing(f: () => Promise<unknown>): Promise<void> {
  try {
    await f()
  } catch (e) {
    console.warn('[drive] gagal memberi izin publik:', (e as Error).message)
  }
}