/**
 * Bootstrap: menyiapkan spreadsheet + folder Drive untuk instalasi BARU.
 *
 * Bedanya dengan scripts/setup-sheet.ts:
 *   setup-sheet.ts  → menambah kolom pada spreadsheet yang SUDAH ada
 *                     (dipakai saat migrasi dari Apps Script)
 *   bootstrap.ts    → membuat spreadsheet & folder dari nol, karena
 *                     spreadsheet baru tidak punya ID sama sekali
 *
 * Skrip ini IDEMPOTEN. Menjalankannya dua kali tidak akan membuat spreadsheet
 * atau akun admin ganda — ID yang sudah ada di .env.local dipakai kembali.
 *
 * Cara pakai:
 *   1. Isi GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *      di .env.local (dari file JSON Service Account).
 *   2. npm run bootstrap
 *
 * Opsional:
 *   npm run bootstrap -- --force            buat spreadsheet/folder baru
 *   npm run bootstrap -- --user admin       username admin pertama
 */

import { randomBytes } from 'node:crypto'
import { bacaEnvFile, setEnvVar, tulisEnvFile } from './lib/env-file'
import { getDrive, getSheets, spreadsheetId } from '../src/lib/google'
import { hashPassword } from '../src/lib/password'
import { listAkun, tambahAkun } from '../src/lib/sheets'
import {
  AKUN_HEADER,
  GURU_HEADER,
  LAPORAN_HEADER,
  PENGATURAN_HEADER,
  ROMBEL_HEADER,
  SISWA_HEADER,
} from '../src/lib/constants'

const ENV_FILE = '.env.local'
const FORCE = process.argv.includes('--force')

function arg(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

/* -------------------------------------------------------------------------- *
 * Google
 * -------------------------------------------------------------------------- */

const SHEET_BARU: Array<{ title: string; header: string[] }> = [
  { title: 'Akun', header: AKUN_HEADER },
  { title: 'Siswa', header: SISWA_HEADER },
  { title: 'Guru', header: GURU_HEADER },
  { title: 'Rombel', header: ROMBEL_HEADER },
  { title: 'Pengaturan', header: PENGATURAN_HEADER },
  { title: 'Laporan', header: LAPORAN_HEADER },
]

async function buatSpreadsheet(): Promise<string> {
  const sheets = getSheets()

  // Menyebutkan `sheets` di requestBody membuat Google TIDAK membuat
  // "Sheet1" default — jadi tidak perlu dihapus terpisah.
  const dibuat = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'E-Rapor Daycare' },
      sheets: SHEET_BARU.map((s) => ({ properties: { title: s.title } })),
    },
  })

  const id = dibuat.data.spreadsheetId
  if (!id) throw new Error('Google tidak mengembalikan spreadsheetId.')
  return id
}

async function tulisHeader(): Promise<void> {
  const sheets = getSheets()
  const id = spreadsheetId()

  for (const s of SHEET_BARU) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${s.title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [s.header] },
    })
    console.log(`  → sheet "${s.title}" (${s.header.length} kolom)`)
  }
}

/**
 * Pastikan semua sheet yang dibutuhkan sudah ada.
 *
 * Spreadsheet bisa datang dari luar — misal dibuat manual lewat browser lalu
 * di-share ke Service Account. Spreadsheet seperti itu hanya punya "Sheet1",
 * dan values.update ke sheet yang tidak ada akan gagal dengan "Unable to parse
 * range". Jadi sheet dibuat lebih dulu, baru header ditulis.
 */
async function pastikanSheetAda(): Promise<void> {
  const sheets = getSheets()
  const id = spreadsheetId()

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: id,
    // Catatan: path yang benar adalah 'sheets.properties.title'.
    // 'spreadsheets.properties.title' akan ditolak dengan 400 INVALID_ARGUMENT.
    fields: 'sheets.properties.title',
  })
  const ada = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ''))

  const kurang = SHEET_BARU.filter((s) => !ada.has(s.title))
  if (kurang.length === 0) {
    console.log('  → semua sheet sudah ada.')
    return
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: kurang.map((s) => ({ addSheet: { properties: { title: s.title } } })),
    },
  })
  console.log(`  → dibuat: ${kurang.map((s) => s.title).join(', ')}`)
}

async function buatFolderDrive(): Promise<string> {
  const drive = getDrive()
  const dibuat = await drive.files.create({
    requestBody: {
      name: 'E-Rapor Daycare (Upload)',
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  })
  const id = dibuat.data.id
  if (!id) throw new Error('Google tidak mengembalikan folder id.')
  return id
}

/* -------------------------------------------------------------------------- *
 * Akun admin pertama
 * -------------------------------------------------------------------------- */

async function seedAdmin(): Promise<void> {
  const existing = await listAkun()
  if (existing.some((a) => a.role === 'admin')) {
    console.log('\nAkun admin sudah ada — tidak ada yang dibuat.')
    return
  }

  const username = arg('user') || process.env.ADMIN_USERNAME || 'admin'
  // Dibuat acak bila tidak diberikan, supaya tidak ada password default
  // yang terlanjur dipakai di server produksi.
  const password = arg('password') || process.env.ADMIN_PASSWORD || randomBytes(6).toString('base64url')

  if (password.length < 8) {
    throw new Error('Kata sandi admin minimal 8 karakter.')
  }

  await tambahAkun({
    role: 'admin',
    username,
    passwordHash: await hashPassword(password),
    idAsli: username,
    nama: 'Administrator',
  })

  console.log(`\nAkun admin pertama dibuat. SIMPAN KREDENSIAL INI:`)
  console.log(`   username : ${username}`)
  console.log(`   password : ${password}`)
  console.log('   (disimpan di password manager — tidak ditampilkan lagi)')
}

/* -------------------------------------------------------------------------- *
 * Diagnosis error
 * -------------------------------------------------------------------------- */

/**
 * Ambil kode alasan spesifik dari Google API.
 *
 * Pesan "The caller does not have permission" sangat ambigu: API-nya belum
 * diaktifkan (SERVICE_DISABLED) sama sekali berbeda dari aksesnya kurang
 * (PERMISSION_DENIED), dan keduanya butuh tindakan yang berbeda.
 */
function detailErrorGoogle(e: unknown): string[] {
  const err = e as {
    response?: {
      data?: {
        error?: {
          status?: string
          message?: string
          errors?: Array<{ reason?: string; domain?: string; message?: string }>
        }
      }
    }
  }
  const g = err.response?.data?.error
  if (!g) return []

  const baris: string[] = []
  if (g.status) baris.push(`status : ${g.status}`)
  for (const x of g.errors ?? []) {
    if (x.reason) baris.push(`reason : ${x.reason}${x.domain ? ` (${x.domain})` : ''}`)
  }
  return baris
}

/* -------------------------------------------------------------------------- */

async function utama() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !key) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY belum diisi.\n' +
        `Isi keduanya di ${ENV_FILE} — ambil dari file JSON Service Account\n` +
        '(field "client_email" dan "private_key").',
    )
  }

  console.log('Bootstrap E-Rapor Daycare')
  console.log(`Service Account : ${email}\n`)

  let isi = bacaEnvFile(ENV_FILE)
  const adaSheetId = !FORCE && Boolean(process.env.GOOGLE_SPREADSHEET_ID)
  const adaFolderId = !FORCE && Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID)

  /* ---- Folder Drive ---- */
  console.log('1. Folder Drive')
  if (adaFolderId) {
    console.log(`  → memakai folder yang sudah ada (${process.env.GOOGLE_DRIVE_FOLDER_ID})`)
  } else {
    const folderId = await buatFolderDrive()
    isi = setEnvVar(isi, 'GOOGLE_DRIVE_FOLDER_ID', folderId)
    process.env.GOOGLE_DRIVE_FOLDER_ID = folderId
    // Simpan SEGERA, bukan di akhir skrip. Kalau pembuatan spreadsheet
    // gagal, folder ini sudah terlanjur ada di Drive — dan kalau ID-nya
    // belum tersimpan, menjalankan ulang skrip akan membuat folder kedua
    // yang terlantar. (Terbukti nyata: Sheets API mati -> folder pertama
    // hilang jejaknya.)
    tulisEnvFile(ENV_FILE, isi)
    console.log(`  → dibuat, id: ${folderId}`)
  }

  /* ---- Spreadsheet ---- */
  console.log('\n2. Spreadsheet')
  if (adaSheetId) {
    console.log(`  → memakai spreadsheet yang sudah ada (${process.env.GOOGLE_SPREADSHEET_ID})`)
  } else {
    const sheetId = await buatSpreadsheet()
    // Diperuhi sebelum dipanggil spreadsheetId() di bawah.
    process.env.GOOGLE_SPREADSHEET_ID = sheetId
    isi = setEnvVar(isi, 'GOOGLE_SPREADSHEET_ID', sheetId)
    console.log(`  → dibuat, id: ${sheetId}`)
    console.log(`     URL: https://docs.google.com/spreadsheets/d/${sheetId}/edit`)
  }

  console.log('\n3. Sheet & header')
  await pastikanSheetAda()
  await tulisHeader()

  /* ---- Simpan ID ---- */
  tulisEnvFile(ENV_FILE, isi)
  console.log(`\nID spreadsheet & folder ditulis ke ${ENV_FILE}`)

  /* ---- Akun admin ---- */
  await seedAdmin()

  console.log('\n' + '='.repeat(66))
  console.log('LANGKAH WAJIB SEBELUM MENJALANKAN APP')
  console.log('='.repeat(66))
  console.log('1. Pastikan spreadsheet & folder di atas di-share ke:')
  console.log(`     ${email}   (akses Editor)`)
  console.log('2. Jalankan dev server: npm run dev')
  if (adaSheetId) {
    console.log('\nSpreadsheet ini dibuat manual (bukan oleh Service Account), jadi')
    console.log('Anda sudah bisa melihatnya di Drive Anda sendiri.')
  } else {
    console.log('\nSpreadsheet dibuat oleh Service Account, jadi sampai di-share ke')
    console.log('akun Anda sendiri, file ini tidak akan terlihat di Drive Anda.')
  }
  console.log('='.repeat(66))
}

utama().catch((e) => {
  console.error('\nGagal:', e instanceof Error ? e.message : e)

  const detail = detailErrorGoogle(e)
  if (detail.length > 0) {
    console.error('\nDetail dari Google API:')
    for (const d of detail) console.error('  ' + d)
    if (detail.some((d) => d.includes('SERVICE_DISABLED'))) {
      console.error('\n  → API tersebut belum diaktifkan. Buka:' +
        '\n    https://console.cloud.google.com/apis/library/sheets.googleapis.com' +
        '\n    Pilih project yang benar, lalu klik Enable.')
    }
  }

  console.error(
    '\nPeriksa lagi:\n' +
      '  1. .env.local ada dan GOOGLE_SERVICE_ACCOUNT_* terisi\n' +
      '  2. Google Sheets API DAN Google Drive API sudah diaktifkan di project itu\n' +
      '  3. Private key ditulis lengkap (-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----)\n' +
      '  4. Spreadsheet di-share ke email Service Account (akses Editor)',
  )
  process.exit(1)
})
