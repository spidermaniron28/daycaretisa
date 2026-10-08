/**
 * Menyiapkan spreadsheet agar cocok dengan aplikasi versi baru.
 *
 * Skrip ini IDEMPOTEN — aman dijalankan berulang kali. Yang dilakukan hanya
 * MENAMBAHKAN kolom yang belum ada di sebelah kanan; kolom lama tidak pernah
 * dihapus, diurutkan ulang, atau ditimpa. Semua data Anda tetap utuh.
 *
 * Cara pakai:
 *   npm run setup:sheet
 *
 * Butuh file .env.local yang sudah terisi (lihat .env.example).
 */

import {
  AKUN_HEADER,
  GURU_HEADER,
  LAPORAN_HEADER,
  PENGATURAN_HEADER,
  ROMBEL_HEADER,
  SARAN_HEADER,
  SISWA_HEADER,
} from '../src/lib/constants'
import { getSheets, spreadsheetId } from '../src/lib/google'
import { pastikanIdLaporan } from '../src/lib/sheets'

interface Rencana {
  sheet: string
  header: string[]
  minimum: number
}

/** Kolom yang boleh ditambahkan, beserta jumlahnya. */
const RENCANA: Rencana[] = [
  { sheet: 'Akun', header: AKUN_HEADER, minimum: 5 },
  { sheet: 'Siswa', header: SISWA_HEADER, minimum: 6 },
  { sheet: 'Guru', header: GURU_HEADER, minimum: 5 },
  { sheet: 'Rombel', header: ROMBEL_HEADER, minimum: 3 },
  { sheet: 'Pengaturan', header: PENGATURAN_HEADER, minimum: 2 },
  { sheet: 'Laporan', header: LAPORAN_HEADER, minimum: 34 },
  { sheet: 'Saran', header: SARAN_HEADER, minimum: 7 },
]

function hurufKolom(index0: number): string {
  const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let i = index0
  let hasil = ''
  do {
    hasil = HURUF[i % 26] + hasil
    i = Math.floor(i / 26) - 1
  } while (i >= 0)
  return hasil
}

async function utama() {
  console.log('Menyiapkan spreadsheet untuk E-Rapor Daycare versi Vercel\n')
  const sheets = getSheets()
  const id = spreadsheetId()

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields: 'sheets.properties',
  })
  const daftarSheet = meta.data.sheets ?? []
  const judulAda = new Set(daftarSheet.map((s) => s.properties?.title ?? ''))
  const idSheet = (judul: string) =>
    daftarSheet.find((s) => s.properties?.title === judul)?.properties?.sheetId

  for (const rencana of RENCANA) {
    console.log(`• Sheet "${rencana.sheet}"`)

    if (!judulAda.has(rencana.sheet)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: [{ addSheet: { properties: { title: rencana.sheet } } }] },
      })
      console.log('  → sheet tidak ada, dibuat baru.')
    }

    // Pastikan grid sheet cukup lebar sebelum menulis — sheet lama bisa
    // dibuat dengan jumlah kolom lebih kecil daripada header terbaru
    // (contoh: sheet Laporan 36 kolom, header baru 41).
    const propSheet = daftarSheet.find((s) => s.properties?.title === rencana.sheet)?.properties
    const lebar = propSheet?.gridProperties?.columnCount ?? 0
    if (lebar < rencana.header.length && propSheet?.sheetId != null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: propSheet.sheetId,
                  gridProperties: { columnCount: rencana.header.length },
                },
                fields: 'gridProperties.columnCount',
              },
            },
          ],
        },
      })
      console.log(`  → grid dilebarkan jadi ${rencana.header.length} kolom.`)
    }

    // Baca header yang ada sekarang.
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${rencana.sheet}!A1:AZ1`,
    })
    const headerSekarang = (res.data.values?.[0] ?? []).map((v) => String(v ?? '').trim())

    // Cari kolom pertama yang belum ada.
    let mulai = headerSekarang.length
    for (let i = 0; i < rencana.header.length; i++) {
      if (headerSekarang[i] !== rencana.header[i]) {
        mulai = i
        break
      }
    }

    if (mulai >= rencana.header.length) {
      console.log('  → sudah lengkap, tidak ada perubahan.')
      continue
    }

    const baru = rencana.header.slice(mulai)
    const kolomMulai = hurufKolom(mulai)

    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${rencana.sheet}!${kolomMulai}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [baru] },
    })

    console.log(
      `  → ditambah: ${baru.map((h, i) => `${hurufKolom(mulai + i)}="${h}"`).join(', ')}`,
    )

    // Perlebar kolom supaya tidak terpotong di sheet. sheetId selalu 0 untuk
    // spreadsheet pertama, tapi lebih aman diambil dari metadata.
    const sheetIdTarget = idSheet(rencana.sheet)
    if (sheetIdTarget !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: {
          requests: [
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: sheetIdTarget,
                  dimension: 'COLUMNS',
                  startIndex: mulai,
                  endIndex: rencana.header.length,
                },
              },
            },
          ],
        },
      })
    }
  }

  console.log('\nMemberi Id Laporan pada laporan lama yang belum punya...')
  const diperbarui = await pastikanIdLaporan().catch(() => 0)
  console.log(
    diperbarui > 0
      ? `  → ${diperbarui} baris diperbarui.`
      : '  → semua laporan sudah punya Id Laporan.',
  )

  console.log('\nSelesai. Spreadsheet siap dipakai aplikasi versi baru.')
}

utama().catch((e) => {
  console.error('\nGagal:', e instanceof Error ? e.message : e)
  console.error(
    '\nPeriksa lagi:\n' +
      '  1. File .env.local sudah ada dan terisi\n' +
      '  2. Spreadsheet di-share ke email Service Account (akses Editor)\n' +
      '  3. Google Sheets API sudah diaktifkan di project tersebut',
  )
  process.exit(1)
})