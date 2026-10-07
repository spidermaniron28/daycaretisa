/**
 * Memindahkan seluruh password lama (polos) menjadi hash scrypt.
 *
 * Normalnya migrasi ini terjadi otomatis saat pengguna login pertama kali.
 * Jalankan skrip ini kalau ingin mengubah seluruh akun sekaligus, misalnya
 * sebelum pindah ke aplikasi versi baru, atau untuk melihat akun mana yang
 * belum pernah login sama sekali.
 *
 * CARA PAKAI:
 *   1. Dry-run dulu (tidak mengubah apa pun):
 *        npm run migrate:password
 *   2. Kalau hasilnya benar, tambahkan --jalankan:
 *        npm run migrate:password -- --jalankan
 */

import { hashPassword, sudahTerhash } from '../src/lib/password'
import { updatePasswordHash } from '../src/lib/sheets'
import { AKUN_COL, SHEET } from '../src/lib/constants'
import { getSheets, spreadsheetId, bacaSheet, barisValid } from '../src/lib/google'
import { str } from '../src/lib/utils'

const JALANKAN = process.argv.includes('--jalankan')

async function utama() {
  console.log(
    JALANKAN
      ? 'Mode: MENJALANKAN perubahan.\n'
      : 'Mode: DRY-RUN (tidak ada yang diubah). Tambahkan --jalankan untuk mengeksekusi.\n',
  )

  const baris = barisValid(await bacaSheet(SHEET.AKUN))
  const sheets = getSheets()
  const id = spreadsheetId()

  let sudah = 0
  let perlu = 0
  const gagal: string[] = []

  for (const b of baris) {
    const username = str(b.nilai[AKUN_COL.USERNAME])
    const role = str(b.nilai[AKUN_COL.ROLE])
    const hashLama = str(b.nilai[AKUN_COL.PASSWORD_HASH])

    if (!username) continue

    if (sudahTerhash(hashLama)) {
      sudah++
      continue
    }

    const polos = str(b.nilai[AKUN_COL.PASSWORD_LAMA])
    if (!polos || polos === '•') {
      gagal.push(`${role}/${username} — tidak ada password lama untuk dimigrasi`)
      continue
    }

    perlu++
    console.log(`  ${role}/${username} → akan di-hash`)

    if (!JALANKAN) continue

    try {
      await updatePasswordHash(username, await hashPassword(polos))

      // Kolom Password lama disamarkan supaya tidak terbaca siapa pun yang
      // membuka spreadsheet secara langsung.
      await sheets.spreadsheets.values.update({
        spreadsheetId: id,
        range: `${SHEET.AKUN}!C${b.rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [['•']] },
      })
    } catch (e) {
      gagal.push(`${role}/${username} — ${(e as Error).message}`)
    }
  }

  console.log('\n--- Ringkasan ---')
  console.log(`Sudah terhash : ${sudah}`)
  console.log(`Perlu dimigrasi: ${perlu}`)
  console.log(`Gagal          : ${gagal.length}`)

  for (const g of gagal) console.log(`  ! ${g}`)

  if (!JALANKAN && perlu > 0) {
    console.log(
      '\nUlangi dengan "--jalankan" untuk menerapkan perubahan:\n  npm run migrate:password -- --jalankan',
    )
  }

  console.log(
    '\nCatatan: password TIDAK bisa dikembalikan ke bentuk polos setelah di-hash.\n' +
      'Pastikan setiap pengguna punya salinan password atau sudah tahu sandinya.',
  )
}

utama().catch((e) => {
  console.error('\nGagal:', e instanceof Error ? e.message : e)
  process.exit(1)
})