import 'server-only'
import { google, type sheets_v4, type drive_v3 } from 'googleapis'
import { cache } from 'react'

/* ---------------------------------------------------------------------------
 * Klien Google Sheets & Drive.
 *
 * PENTING:
 *  - Client di-cache di globalThis. Membuat kredensial baru tiap request itu
 *    lambat dan kena rate limit.
 *  - Semua akses memakai SPREADSHEET_ID eksplisit, bukan getActiveSpreadsheet(),
 *    supaya tidak bergantung file mana yang kebetulan dibuka di browser.
 *  - Sheet & folder WAJIB di-share ke email service account, kalau tidak semua
 *    request akan 404/403.
 * ------------------------------------------------------------------------- */

declare global {
  var __eraporGoogle:
    | { sheets: sheets_v4.Sheets; drive: drive_v3.Drive }
    | undefined
}

function buatClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !rawKey) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY belum diisi. ' +
        'Salin .env.example menjadi .env.local lalu isi kredensial Service Account.',
    )
  }

  // Private key dari env sering datang dengan literal "\n" atau spasi indentasi.
  const privateKey = rawKey.replace(/\\n/g, '\n').trim()

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    // Scope `drive.file` hanya melihat file yang dibuat/dibuka aplikasi —
    // folder milik user yang di-share ke SA404 lewat scope itu (terverifikasi
    // lewat probe 2026-10-06). Upload foto butuh folder tujuan milik user,
    // jadi SA harus memakai scope `drive` penuh. Konsekuensinya: SA bisa
    // melihat semua file yang di-share ke-nya — wajar untuk instalasi
    // single-tenant ini.
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  })

  return {
    sheets: google.sheets({ version: 'v4', auth }),
    drive: google.drive({ version: 'v3', auth }),
  }
}

export function googleClient() {
  if (!globalThis.__eraporGoogle) {
    globalThis.__eraporGoogle = buatClient()
  }
  return globalThis.__eraporGoogle
}

export function spreadsheetId(): string {
  const id = process.env.GOOGLE_SPREADSHEET_ID
  if (!id) {
    throw new Error(
      'GOOGLE_SPREADSHEET_ID belum diisi. Ambil dari URL spreadsheet: /spreadsheets/d/<ID>/edit',
    )
  }
  return id
}

/**
 * Jenis folder tujuan upload.
 *
 * Foto kegiatan sengaja dipisah dari foto profil supaya isi tiap folder rapi
 * saat dibuka langsung di Google Drive — dua-duanya memakai akun pemilik yang
 * sama, hanya folder induknya yang berbeda.
 */
export type FolderUpload = 'profil' | 'kegiatan'

const KUNCI_FOLDER: Record<FolderUpload, string> = {
  profil: 'GOOGLE_DRIVE_FOLDER_ID',
  kegiatan: 'GOOGLE_DRIVE_FOLDER_KEGIATAN',
}

/** ID folder Drive tujuan untuk jenis upload tertentu. */
export function driveFolderId(jenis: FolderUpload = 'profil'): string {
  const id = process.env[KUNCI_FOLDER[jenis]]
  if (id) return id

  // GOOGLE_DRIVE_FOLDER_KEGIATAN baru ditambahkan belakangan. Kalau belum diisi
  // di .env.local, foto kegiatan masuk ke folder foto profil dan hanya dicatat
  // di log server — lebih baik daripada guru tidak bisa menyimpan laporan.
  if (jenis === 'kegiatan') {
    const cadangan = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (cadangan) {
      console.warn(
        '[drive] GOOGLE_DRIVE_FOLDER_KEGIATAN belum diisi — foto kegiatan ditulis ke folder foto profil.',
      )
      return cadangan
    }
  }

  throw new Error(
    `${KUNCI_FOLDER[jenis]} belum diisi. Ambil dari URL folder Drive: /drive/folders/<ID>.`,
  )
}

export function getSheets(): sheets_v4.Sheets {
  return googleClient().sheets
}

export function getDrive(): drive_v3.Drive {
  return googleClient().drive
}

/* ---------------------------------------------------------------------------
 * Helper baca sheet.
 * ------------------------------------------------------------------------- */

export interface BarisSheet {
  /** Nomor baris asli di spreadsheet (1-based, termasuk header). */
  rowNumber: number
  /** Nilai kolom 0-based. */
  nilai: string[]
}

/** Ambil isi sheet langsung dari Google, tanpa cache. */
async function bacaSheetDariGoogle(namaSheet: string): Promise<BarisSheet[]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${namaSheet}!A1:AZ`,
    valueRenderOption: 'FORMATTED_VALUE',
  })

  const values = res.data.values ?? []
  return values.map((row, i) => ({
    rowNumber: i + 1,
    nilai: row.map((v) => (v === null || v === undefined ? '' : String(v))),
  }))
}

/*
 * Cache baca berumur pendek.
 *
 * Setiap perpindahan menu dulu menunggu panggilan Google Sheets baru, itulah
 * sebabnya terasa lambat. Dengan menghafal hasil baca selama beberapa detik,
 * menu yang datanya sama tidak perlu bolak-balik ke Google. Cache dibuang
 * segera setelah ada penulisan (lihat invalidasiCacheSheet) supaya data yang
 * baru diubah langsung terlihat.
 */
const TTL_CACHE_MS = 20_000

interface EntriCacheSheet {
  nilai: BarisSheet[]
  kedaluwarsa: number
}

const cacheHasilSheet = new Map<string, EntriCacheSheet>()

/** Buang semua hasil baca yang tersimpan. Dipanggil setiap kali sheet ditulis. */
export function invalidasiCacheSheet(): void {
  cacheHasilSheet.clear()
}

/**
 * Baca seluruh isi sebuah sheet sebagai array nilai string.
 *
 * valueRenderOption FORMATTED_VALUE mengembalikan jam sebagai "07:30" dan
 * tanggal sebagai "02/10/2026" — persis seperti yang dulu dibaca Apps Script,
 * sehingga data lama tidak perlu konversi.
 *
 * Rentang sampai AZ (52 kolom) itu penting: sheet Laporan punya 36 kolom, dan
 * kolom Foto Kegiatan / Id Laporan / Notifikasi berada di kolom AH–AJ. Kalau
 * rentangnya hanya A1:Z, kolom itu akan terpotong diam-diam dan foto tidak
 * pernah muncul di portal orang tua.
 *
 * Dibungkus `cache()` React agar beberapa pemanggilan dalam satu request hanya
 * menembak Google sekali, lalu cache TTL di atas yang menahan hasil antar request.
 */
export const bacaSheet = cache(
  async (namaSheet: string): Promise<BarisSheet[]> => {
    const sekarang = Date.now()
    const tersimpan = cacheHasilSheet.get(namaSheet)
    if (tersimpan && tersimpan.kedaluwarsa > sekarang) return tersimpan.nilai

    const nilai = await bacaSheetDariGoogle(namaSheet)
    cacheHasilSheet.set(namaSheet, { nilai, kedaluwarsa: sekarang + TTL_CACHE_MS })
    return nilai
  },
)

/** Buang baris kosong lalu buang kolom kosong. */
export function barisValid(baris: BarisSheet[]): BarisSheet[] {
  return baris
    .slice(1) // buang header
    .filter((b) => b.nilai.some((v) => v.trim() !== ''))
}