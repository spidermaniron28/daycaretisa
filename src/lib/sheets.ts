import 'server-only'
import { getSheets, spreadsheetId, bacaSheet, barisValid, invalidasiCacheSheet } from './google'
import {
  SHEET,
  AKUN_COL,
  SISWA_COL,
  GURU_COL,
  ROMBEL_COL,
  LAPORAN_COL,
  LAPORAN_TOTAL_KOLOM,
  PENGATURAN_COL,
} from './constants'
import { str, strOrDash, uuid } from './utils'
import type { Akun, DataLaporan, Guru, Pengaturan, Rombel, Role, Siswa } from './types'

/* ---------------------------------------------------------------------------
 * Repository: satu-satunya tempat yang boleh bicara langsung dengan sheet.
 *
 * Semua fungsi baca memakai nilai ber-format (jam tetap "07:30", tanggal tetap
 * "02/10/2026") sehingga apa yang tersimpan sama persis dengan yang dibaca —
 * persis seperti perilaku Apps Script pada aplikasi lama.
 * ------------------------------------------------------------------------- */

/* ============================ UTILITAS ================================== */

/**
 * Buang cache baca berumur pendek setelah ada penulisan.
 *
 * Tanpa ini, perubahan yang baru disimpan bisa tertahan di cache dan pengguna
 * melihat data lama sampai cache-nya kedaluwarsa.
 */
function lupakanCache(): void {
  invalidasiCacheSheet()
  cacheJumlahKolom.clear()
}

async function appendRows(namaSheet: string, rows: unknown[][]): Promise<void> {
  if (rows.length === 0) return
  await getSheets().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${namaSheet}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  })
  lupakanCache()
}

async function updateRow(
  namaSheet: string,
  rowNumber: number,
  kolomMulai: number,
  nilai: unknown[],
): Promise<void> {
  const kolom = kolomDariIndeks(kolomMulai)
  await getSheets().spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${namaSheet}!${kolom}${rowNumber}:${hurufKolom(
      kolomMulai + nilai.length - 1,
    )}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [nilai] },
  })
  lupakanCache()
}

/**
 * Kosongkan satu baris.
 *
 * Selalu dibersihkan sampai kolom AZ, bukan hanya sampai jumlah kolom yang
 * dilaporkan gridProperties: sheet Laporan bisa punya data di kolom AH–AJ
 * sementara grid masih tercatat 26 kolom, sehingga sisanya akan tertinggal
 * dan baris itu terbaca lagi sebagai data lama.
 */
async function clearRow(namaSheet: string, rowNumber: number): Promise<void> {
  const jumlah = Math.max(await jumlahKolom(namaSheet), 52)
  await getSheets().spreadsheets.values.clear({
    spreadsheetId: spreadsheetId(),
    range: `${namaSheet}!A${rowNumber}:${hurufKolom(jumlah - 1)}${rowNumber}`,
  })
  lupakanCache()
}

const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function hurufKolom(index0: number): string {
  let i = index0
  let hasil = ''
  do {
    hasil = HURUF[i % 26] + hasil
    i = Math.floor(i / 26) - 1
  } while (i >= 0)
  return hasil
}

function kolomDariIndeks(index0: number): string {
  return hurufKolom(index0)
}

const cacheJumlahKolom = new Map<string, number>()

async function jumlahKolom(namaSheet: string): Promise<number> {
  if (!cacheJumlahKolom.has(namaSheet)) {
    const meta = await getSheets().spreadsheets.get({
      spreadsheetId: spreadsheetId(),
      fields: `sheets.properties(title,gridProperties.columnCount)`,
    })
    const found = meta.data.sheets?.find((s) => s.properties?.title === namaSheet)
    cacheJumlahKolom.set(namaSheet, found?.properties?.gridProperties?.columnCount ?? 26)
  }
  return cacheJumlahKolom.get(namaSheet)!
}

/** Cari nomor baris (1-based, termasuk header) untuk nilai tertentu di sebuah kolom. */
async function cariBaris(
  namaSheet: string,
  indeksKolom: number,
  nilaiDicari: string,
): Promise<number | null> {
  const baris = barisValid(await bacaSheet(namaSheet))
  const target = nilaiDicari.toString()
  const ketemu = baris.find((b) => b.nilai[indeksKolom]?.toString() === target)
  return ketemu ? ketemu.rowNumber : null
}

/* ============================== AKUN ==================================== */

export async function listAkun(): Promise<Akun[]> {
  const baris = barisValid(await bacaSheet(SHEET.AKUN))
  const hasil: Akun[] = []

  for (const b of baris) {
    const role = str(b.nilai[AKUN_COL.ROLE]).toLowerCase() as Role
    if (!['admin', 'guru', 'siswa'].includes(role)) continue

    const username = str(b.nilai[AKUN_COL.USERNAME])
    const idAsli = str(b.nilai[AKUN_COL.ID_ASLI]) || username
    const hash = str(b.nilai[AKUN_COL.PASSWORD_HASH])

    hasil.push({
      role,
      username,
      idAsli,
      namaLengkap: str(b.nilai[AKUN_COL.NAMA]) || fallbackNama(role, idAsli),
      passwordTerhash: hash.startsWith('scrypt$'),
      dibuat: str(b.nilai[AKUN_COL.DIBUAT]),
    })
  }
  return hasil
}

function fallbackNama(role: Role, idAsli: string): string {
  if (role === 'admin') return 'Administrator'
  return idAsli
}

type HasilCariAkun = {
  akun: Akun
  rowNumber: number
  passwordHash: string
  passwordLama: string
} | null

/**
 * Cari baris akun yang dipakai login.
 *
 * Dicocokkan dengan kolom `Username`, lalu — bila tidak ada — dengan kolom
 * `ID Asli` (NIS untuk siswa, NIP untuk guru). Sekolah biasanya hanya
 * membagikan NIS/NIP, sedangkan `Username` bisa berisi nama panggilan
 * (mis. siswa NIS `SISWA-1` punya username `ridwan`). Bila dua baris cocok,
 * `Username` yang sama persis selalu menang.
 */
export async function cariAkunByUsername(
  username: string,
  role: Role,
): Promise<HasilCariAkun> {
  const baris = barisValid(await bacaSheet(SHEET.AKUN))
  const target = username.toString()

  const rangkai = (b: (typeof baris)[number], u: string, idAsli: string): NonNullable<HasilCariAkun> => {
    const hash = str(b.nilai[AKUN_COL.PASSWORD_HASH])
    return {
      rowNumber: b.rowNumber,
      passwordHash: hash,
      passwordLama: str(b.nilai[AKUN_COL.PASSWORD_LAMA]),
      akun: {
        role,
        username: u,
        idAsli,
        namaLengkap: str(b.nilai[AKUN_COL.NAMA]) || fallbackNama(role, idAsli),
        passwordTerhash: hash.startsWith('scrypt$'),
        dibuat: str(b.nilai[AKUN_COL.DIBUAT]),
      },
    }
  }

  let lewatIdAsli: NonNullable<HasilCariAkun> | null = null

  for (const b of baris) {
    const r = str(b.nilai[AKUN_COL.ROLE]).toLowerCase() as Role
    if (r !== role) continue

    const u = str(b.nilai[AKUN_COL.USERNAME])
    const idAsli = str(b.nilai[AKUN_COL.ID_ASLI]) || u

    if (u === target) return rangkai(b, u, idAsli)
    if (!lewatIdAsli && idAsli === target) lewatIdAsli = rangkai(b, u, idAsli)
  }

  return lewatIdAsli
}

export async function akunExists(username: string): Promise<boolean> {
  const semua = await listAkun()
  return semua.some((a) => a.username === username.toString())
}

export async function tambahAkun(input: {
  role: Role
  username: string
  passwordHash: string
  idAsli: string
  nama: string
}): Promise<void> {
  await appendRows(SHEET.AKUN, [
    [
      input.role,
      input.username,
      '•', // kolom lama: tidak lagi menyimpan password asli
      input.idAsli,
      input.nama,
      input.passwordHash,
      new Date().toISOString().slice(0, 10),
    ],
  ])
}

/**
 * Tulis hash baru + samarkan kolom password lama.
 * Kolom Password (C) dan PasswordHash (F) tidak berurutan, jadi ditulis terpisah
 * — jangan gabungkan jadi satu updateRange atau ID Asli/Nama akan tertimpa.
 */
async function tulisHashDanSamarkan(rowNumber: number, hash: string): Promise<void> {
  await updateRow(SHEET.AKUN, rowNumber, AKUN_COL.PASSWORD_LAMA, ['•'])
  await updateRow(SHEET.AKUN, rowNumber, AKUN_COL.PASSWORD_HASH, [hash])
}

/** Dipakai saat migrasi lazy: user login pertama dengan password lama. */
export async function simpanHashBaru(rowNumber: number, hash: string): Promise<void> {
  await tulisHashDanSamarkan(rowNumber, hash)
}

export async function updatePasswordHash(username: string, hash: string): Promise<boolean> {
  const rowNumber = await cariBarisByUsername(username)
  if (!rowNumber) return false
  await tulisHashDanSamarkan(rowNumber, hash)
  return true
}

async function cariBarisByUsername(username: string): Promise<number | null> {
  const baris = barisValid(await bacaSheet(SHEET.AKUN))
  const ketemu = baris.find((b) => str(b.nilai[AKUN_COL.USERNAME]) === username.toString())
  return ketemu ? ketemu.rowNumber : null
}

export async function updateUsername(
  oldUsername: string,
  newUsername: string,
): Promise<void> {
  const rowNumber = await cariBarisByUsername(oldUsername)
  if (!rowNumber) throw new Error('Username lama tidak ditemukan.')
  await updateRow(SHEET.AKUN, rowNumber, AKUN_COL.USERNAME, [newUsername])
}

export async function updateNamaAkun(username: string, namaBaru: string): Promise<void> {
  const rowNumber = await cariBarisByUsername(username)
  if (!rowNumber) throw new Error('Username tidak ditemukan.')
  await updateRow(SHEET.AKUN, rowNumber, AKUN_COL.NAMA, [namaBaru])
}

export async function hapusAkun(username: string): Promise<void> {
  const rowNumber = await cariBarisByUsername(username)
  if (!rowNumber) throw new Error('Akun tidak ditemukan.')
  await clearRow(SHEET.AKUN, rowNumber)
}

/**
 * Hapus akun milik satu guru/siswa, dicocokkan lewat kolom ID Asli.
 *
 * Dipakai saat data guru/siswa dihapus: akun login-nya ikut hilang supaya NIP
 * atau NIS yang sama bisa dipakai lagi oleh data baru tanpa bentrok username.
 * Aman dipanggil walau akunnya tidak ada — return false, bukan error.
 */
export async function hapusAkunByIdAsli(idAsli: string): Promise<boolean> {
  const target = idAsli.toString()
  const baris = barisValid(await bacaSheet(SHEET.AKUN))
  const ketemu = baris.find((b) => str(b.nilai[AKUN_COL.ID_ASLI]) === target)
  if (!ketemu) return false
  await clearRow(SHEET.AKUN, ketemu.rowNumber)
  return true
}

/* ============================== SISWA =================================== */

export async function listSiswa(): Promise<Siswa[]> {
  const baris = barisValid(await bacaSheet(SHEET.SISWA))
  return baris
    .filter((b) => str(b.nilai[SISWA_COL.NIS]) !== '')
    .map((b) => ({
      nis: str(b.nilai[SISWA_COL.NIS]),
      nama: str(b.nilai[SISWA_COL.NAMA]),
      kelas: str(b.nilai[SISWA_COL.KELAS]),
      jk: str(b.nilai[SISWA_COL.JK]),
      status: str(b.nilai[SISWA_COL.STATUS]) || 'Aktif',
      foto: str(b.nilai[SISWA_COL.FOTO]),
      emailOrtu: str(b.nilai[SISWA_COL.EMAIL_ORTU]),
      noWhatsapp: str(b.nilai[SISWA_COL.WA_ORTU]),
      tanggalLahir: str(b.nilai[SISWA_COL.TANGGAL_LAHIR]),
    }))
}

export async function siswaByNis(nis: string): Promise<Siswa | null> {
  const semua = await listSiswa()
  return semua.find((s) => s.nis === nis.toString()) ?? null
}

export async function tambahSiswa(
  s: Omit<Siswa, 'foto' | 'emailOrtu' | 'noWhatsapp'>,
): Promise<void> {
  await appendRows(SHEET.SISWA, [
    [s.nis, s.nama, s.kelas, s.jk, s.status, '', '', '', s.tanggalLahir ?? ''],
  ])
}

export async function updateSiswa(
  oldNis: string,
  s: Omit<Siswa, 'foto' | 'emailOrtu' | 'noWhatsapp'>,
): Promise<void> {
  const rowNumber = await cariBaris(SHEET.SISWA, SISWA_COL.NIS, oldNis)
  if (!rowNumber) throw new Error('Data siswa tidak ditemukan.')
  await updateRow(SHEET.SISWA, rowNumber, SISWA_COL.NIS, [
    s.nis,
    s.nama,
    s.kelas,
    s.jk,
    s.status,
  ])
  // Tanggal lahir adalah kolom terpisah (8) — ditulis terpisah supaya kolom
  // 5..7 (Foto/Email/WA) yang ditulis fungsi lain tidak tertimpa.
  await updateRow(SHEET.SISWA, rowNumber, SISWA_COL.TANGGAL_LAHIR, [
    s.tanggalLahir ?? '',
  ])

  // Sinkronkan ID Asli & nama di sheet Akun supaya akun siswa tidak rusak
  // (menyalin perilaku updateDataSiswa di Kode.gs lama).
  const barisAkun = barisValid(await bacaSheet(SHEET.AKUN))
  const ketemu = barisAkun.find(
    (b) =>
      str(b.nilai[AKUN_COL.ROLE]).toLowerCase() === 'siswa' &&
      str(b.nilai[AKUN_COL.ID_ASLI]) === oldNis,
  )
  if (ketemu) {
    await updateRow(SHEET.AKUN, ketemu.rowNumber, AKUN_COL.ID_ASLI, [s.nis, s.nama])
  }
}

export async function hapusSiswa(nis: string): Promise<void> {
  const rowNumber = await cariBaris(SHEET.SISWA, SISWA_COL.NIS, nis)
  if (!rowNumber) throw new Error('Data siswa tidak ditemukan.')
  await clearRow(SHEET.SISWA, rowNumber)
}

export async function updateFotoSiswa(nis: string, url: string): Promise<void> {
  const rowNumber = await cariBaris(SHEET.SISWA, SISWA_COL.NIS, nis)
  if (!rowNumber) throw new Error('Data siswa tidak ditemukan.')
  await updateRow(SHEET.SISWA, rowNumber, SISWA_COL.FOTO, [url])
}

export async function updateKontakSiswa(
  nis: string,
  emailOrtu: string,
  noWa: string,
): Promise<void> {
  const rowNumber = await cariBaris(SHEET.SISWA, SISWA_COL.NIS, nis)
  if (!rowNumber) throw new Error('Data siswa tidak ditemukan.')
  await updateRow(SHEET.SISWA, rowNumber, SISWA_COL.EMAIL_ORTU, [emailOrtu, noWa])
}

/* =============================== GURU ==================================== */

export async function listGuru(): Promise<Guru[]> {
  const baris = barisValid(await bacaSheet(SHEET.GURU))
  return baris
    .filter((b) => str(b.nilai[GURU_COL.NIP]) !== '')
    .map((b) => ({
      nip: str(b.nilai[GURU_COL.NIP]),
      nama: str(b.nilai[GURU_COL.NAMA]),
      mapel: str(b.nilai[GURU_COL.MAPEL]),
      nohp: str(b.nilai[GURU_COL.NOHP]),
      foto: str(b.nilai[GURU_COL.FOTO]),
      email: str(b.nilai[GURU_COL.EMAIL]),
    }))
}

export async function guruByNip(nip: string): Promise<Guru | null> {
  const semua = await listGuru()
  return semua.find((g) => g.nip === nip.toString()) ?? null
}

export async function tambahGuru(g: Omit<Guru, 'foto' | 'email'>): Promise<void> {
  await appendRows(SHEET.GURU, [[g.nip, g.nama, g.mapel, g.nohp, '', '']])
}

export async function updateGuru(
  nip: string,
  g: Omit<Guru, 'foto' | 'email'>,
): Promise<void> {
  const rowNumber = await cariBaris(SHEET.GURU, GURU_COL.NIP, nip)
  if (!rowNumber) throw new Error('Data guru tidak ditemukan.')
  await updateRow(SHEET.GURU, rowNumber, GURU_COL.NIP, [g.nip, g.nama, g.mapel, g.nohp])
}

export async function hapusGuru(nip: string): Promise<void> {
  const rowNumber = await cariBaris(SHEET.GURU, GURU_COL.NIP, nip)
  if (!rowNumber) throw new Error('Data guru tidak ditemukan.')
  await clearRow(SHEET.GURU, rowNumber)
}

export async function updateFotoGuru(nip: string, url: string): Promise<void> {
  const rowNumber = await cariBaris(SHEET.GURU, GURU_COL.NIP, nip)
  if (!rowNumber) throw new Error('Data guru tidak ditemukan.')
  await updateRow(SHEET.GURU, rowNumber, GURU_COL.FOTO, [url])
}

/* ============================== ROMBEL =================================== */

export async function listRombel(): Promise<Rombel[]> {
  const baris = barisValid(await bacaSheet(SHEET.ROMBEL))
  return baris
    .filter((b) => str(b.nilai[ROMBEL_COL.KODE]) !== '')
    .map((b) => ({
      kode: str(b.nilai[ROMBEL_COL.KODE]),
      nama: str(b.nilai[ROMBEL_COL.NAMA]),
      wali: str(b.nilai[ROMBEL_COL.WALI]),
    }))
}

export async function tambahRombel(r: Rombel): Promise<void> {
  await appendRows(SHEET.ROMBEL, [[r.kode, r.nama, r.wali]])
}

export async function hapusRombel(kode: string): Promise<void> {
  const rowNumber = await cariBaris(SHEET.ROMBEL, ROMBEL_COL.KODE, kode)
  if (!rowNumber) throw new Error('Kelas tidak ditemukan.')
  await clearRow(SHEET.ROMBEL, rowNumber)
}

/* ============================ PENGATURAN ================================ */

/**
 * Awal kunci pengaturan yang bersifat RAHASIA.
 *
 * Baris rahasia (mis. refresh token Drive) sengaja TIDAK ikut dikembalikan
 * listPengaturan, karena hasil listPengaturan dikirim sebagai prop ke komponen
 * client (halaman login & halaman Sistem) sehingga ikut terlihat di HTML/RSC
 * payload. Baca khusus lewat bacaPengaturanRahasia().
 */
export const PREFIX_RAHASIA = '_'

export async function listPengaturan(): Promise<Pengaturan> {
  const baris = barisValid(await bacaSheet(SHEET.PENGATURAN))
  const hasil: Pengaturan = {}
  for (const b of baris) {
    const key = str(b.nilai[PENGATURAN_COL.KEY])
    if (key && !key.startsWith(PREFIX_RAHASIA)) hasil[key] = str(b.nilai[PENGATURAN_COL.VALUE])
  }
  return hasil
}

/** Baca satu baris rahasia (kunci berawalan "_"). null bila belum ada. */
export async function bacaPengaturanRahasia(key: string): Promise<string | null> {
  if (!key.startsWith(PREFIX_RAHASIA)) {
    throw new Error(`bacaPengaturanRahasia hanya untuk kunci berawalan "${PREFIX_RAHASIA}".`)
  }

  const baris = barisValid(await bacaSheet(SHEET.PENGATURAN))
  const cocok = baris.find((b) => str(b.nilai[PENGATURAN_COL.KEY]) === key)
  const nilai = cocok ? str(cocok.nilai[PENGATURAN_COL.VALUE]) : ''
  return nilai === '' ? null : nilai
}

/**
 * Ambil pengaturan tanpa melempar error.
 *
 * Dipakai halaman yang harus tetap tampil walau kredensial Google bermasalah —
 * lebih baik tampilkan nilai kosong daripada halaman putih karena 500.
 */
export async function pengaturanAman(): Promise<Pengaturan> {
  try {
    return await listPengaturan()
  } catch (e) {
    console.error('[pengaturan] gagal memuat:', (e as Error).message)
    return {}
  }
}

/**
 * Tulis pengaturan.
 *
 * Hanya kunci yang dikirim yang ditulis — baris rahasia (prefix "_") tidak
 * pernah ikut terhapus walau formulir pengaturan tidak mengenalnya.
 */
export async function setPengaturan(values: Record<string, string>): Promise<void> {
  const baris = barisValid(await bacaSheet(SHEET.PENGATURAN))
  const indeks = new Map<string, number>()
  baris.forEach((b) => indeks.set(str(b.nilai[PENGATURAN_COL.KEY]), b.rowNumber))

  const baru: string[][] = []
  for (const [key, value] of Object.entries(values)) {
    const rowNumber = indeks.get(key)
    if (rowNumber) {
      await updateRow(SHEET.PENGATURAN, rowNumber, PENGATURAN_COL.VALUE, [value])
    } else {
      baru.push([key, value])
    }
  }
  await appendRows(SHEET.PENGATURAN, baru)
}

/* ============================== LAPORAN ================================== */

/** Parse satu baris sheet Laporan menjadi objek DataLaporan. */
function barisKeLaporan(b: { rowNumber: number; nilai: string[] }): DataLaporan {
  const n = b.nilai
  return {
    id: str(n[LAPORAN_COL.ID]) || `legacy-${b.rowNumber}`,
    dibuat: str(n[LAPORAN_COL.TIMESTAMP]),
    tanggal: str(n[LAPORAN_COL.TANGGAL]),
    guruNip: str(n[LAPORAN_COL.NIP_GURU]),
    nis: str(n[LAPORAN_COL.NIS_SISWA]),
    datang: strOrDash(n[LAPORAN_COL.DATANG]),
    pulang: strOrDash(n[LAPORAN_COL.PULANG]),
    penjemput: strOrDash(n[LAPORAN_COL.PENJEMPUT]),
    sarapan: {
      menu: strOrDash(n[LAPORAN_COL.SARAPAN_MENU]),
      habis: strOrDash(n[LAPORAN_COL.SARAPAN_HABIS]),
      catatan: strOrDash(n[LAPORAN_COL.SARAPAN_CAT]),
    },
    campagi: {
      menu: strOrDash(n[LAPORAN_COL.CAMPAGI_MENU]),
      habis: strOrDash(n[LAPORAN_COL.CAMPAGI_HABIS]),
      catatan: strOrDash(n[LAPORAN_COL.CAMPAGI_CAT]),
    },
    siang: {
      menu: strOrDash(n[LAPORAN_COL.SIANG_MENU]),
      habis: strOrDash(n[LAPORAN_COL.SIANG_HABIS]),
      catatan: strOrDash(n[LAPORAN_COL.SIANG_CAT]),
    },
    camsore: {
      menu: strOrDash(n[LAPORAN_COL.CAMSORE_MENU]),
      habis: strOrDash(n[LAPORAN_COL.CAMSORE_HABIS]),
      catatan: strOrDash(n[LAPORAN_COL.CAMSORE_CAT]),
    },
    tidur: {
      datang: strOrDash(n[LAPORAN_COL.TIDUR_DATANG]),
      bangun: strOrDash(n[LAPORAN_COL.TIDUR_BANGUN]),
      durasi: strOrDash(n[LAPORAN_COL.TIDUR_DURASI]),
      kualitas: strOrDash(n[LAPORAN_COL.TIDUR_KUALITAS]),
    },
    kesehatan: {
      suhu: strOrDash(n[LAPORAN_COL.SUHU]),
      kondisi: strOrDash(n[LAPORAN_COL.KONDISI]),
      bakBab: strOrDash(n[LAPORAN_COL.BAK_BAB]),
      kebersihan: strOrDash(n[LAPORAN_COL.KEBERSIHAN]),
      obat: strOrDash(n[LAPORAN_COL.OBAT]),
    },
    pertumbuhan: {
      beratBadan: strOrDash(n[LAPORAN_COL.BERAT_BADAN] ?? ''),
      interpretasiBB: strOrDash(n[LAPORAN_COL.INTERPRETASI_BB] ?? ''),
      tinggiBadan: strOrDash(n[LAPORAN_COL.TINGGI_BADAN] ?? ''),
      interpretasiTB: strOrDash(n[LAPORAN_COL.INTERPRETASI_TB] ?? ''),
      lingkarKepala: strOrDash(n[LAPORAN_COL.LINGKAR_KEPALA] ?? ''),
    },
    perilaku: {
      interaksi: strOrDash(n[LAPORAN_COL.INTERAKSI]),
      kepatuhan: strOrDash(n[LAPORAN_COL.KEPATUHAN]),
      kemandirian: strOrDash(n[LAPORAN_COL.KEMANDIRIAN]),
      mood: strOrDash(n[LAPORAN_COL.MOOD]),
      catatanPengasuh: strOrDash(n[LAPORAN_COL.CATATAN]),
    },
    fotoKegiatan: parseFoto(str(n[LAPORAN_COL.FOTO])),
    notifikasi: str(n[LAPORAN_COL.NOTIFIKASI]),
  }
}

/** Foto lama disimpan sebagai JSON array; versi sangat lama bisa string tunggal. */
function parseFoto(raw: string): string[] {
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  return [raw]
}

function laporanKeBaris(l: DataLaporan): unknown[] {
  const baris = new Array(LAPORAN_TOTAL_KOLOM).fill('')
  baris[LAPORAN_COL.TIMESTAMP] = l.dibuat || new Date().toISOString()
  baris[LAPORAN_COL.TANGGAL] = l.tanggal
  baris[LAPORAN_COL.NIP_GURU] = l.guruNip
  baris[LAPORAN_COL.NIS_SISWA] = l.nis
  baris[LAPORAN_COL.DATANG] = l.datang
  baris[LAPORAN_COL.PULANG] = l.pulang
  baris[LAPORAN_COL.PENJEMPUT] = l.penjemput
  baris[LAPORAN_COL.SARAPAN_MENU] = l.sarapan.menu
  baris[LAPORAN_COL.SARAPAN_HABIS] = l.sarapan.habis
  baris[LAPORAN_COL.SARAPAN_CAT] = l.sarapan.catatan
  baris[LAPORAN_COL.CAMPAGI_MENU] = l.campagi.menu
  baris[LAPORAN_COL.CAMPAGI_HABIS] = l.campagi.habis
  baris[LAPORAN_COL.CAMPAGI_CAT] = l.campagi.catatan
  baris[LAPORAN_COL.SIANG_MENU] = l.siang.menu
  baris[LAPORAN_COL.SIANG_HABIS] = l.siang.habis
  baris[LAPORAN_COL.SIANG_CAT] = l.siang.catatan
  baris[LAPORAN_COL.CAMSORE_MENU] = l.camsore.menu
  baris[LAPORAN_COL.CAMSORE_HABIS] = l.camsore.habis
  baris[LAPORAN_COL.CAMSORE_CAT] = l.camsore.catatan
  baris[LAPORAN_COL.TIDUR_DATANG] = l.tidur.datang
  baris[LAPORAN_COL.TIDUR_BANGUN] = l.tidur.bangun
  baris[LAPORAN_COL.TIDUR_DURASI] = l.tidur.durasi
  baris[LAPORAN_COL.TIDUR_KUALITAS] = l.tidur.kualitas
  baris[LAPORAN_COL.SUHU] = l.kesehatan.suhu
  baris[LAPORAN_COL.KONDISI] = l.kesehatan.kondisi
  baris[LAPORAN_COL.BAK_BAB] = l.kesehatan.bakBab
  baris[LAPORAN_COL.KEBERSIHAN] = l.kesehatan.kebersihan
  baris[LAPORAN_COL.OBAT] = l.kesehatan.obat
  baris[LAPORAN_COL.INTERAKSI] = l.perilaku.interaksi
  baris[LAPORAN_COL.KEPATUHAN] = l.perilaku.kepatuhan
  baris[LAPORAN_COL.KEMANDIRIAN] = l.perilaku.kemandirian
  baris[LAPORAN_COL.MOOD] = l.perilaku.mood
  baris[LAPORAN_COL.CATATAN] = l.perilaku.catatanPengasuh
  baris[LAPORAN_COL.BERAT_BADAN] = l.pertumbuhan.beratBadan
  baris[LAPORAN_COL.INTERPRETASI_BB] = l.pertumbuhan.interpretasiBB
  baris[LAPORAN_COL.TINGGI_BADAN] = l.pertumbuhan.tinggiBadan
  baris[LAPORAN_COL.INTERPRETASI_TB] = l.pertumbuhan.interpretasiTB
  baris[LAPORAN_COL.LINGKAR_KEPALA] = l.pertumbuhan.lingkarKepala
  baris[LAPORAN_COL.FOTO] = l.fotoKegiatan.length ? JSON.stringify(l.fotoKegiatan) : ''
  baris[LAPORAN_COL.ID] = l.id
  baris[LAPORAN_COL.NOTIFIKASI] = l.notifikasi
  return baris
}

/** Semua laporan guru (terbaru di atas), sudah di-decode. */
export async function listLaporanGuru(nip: string): Promise<DataLaporan[]> {
  const baris = barisValid(await bacaSheet(SHEET.LAPORAN))
  const hasil: DataLaporan[] = []
  for (const b of baris) {
    if (str(b.nilai[LAPORAN_COL.NIP_GURU]) !== nip.toString()) continue
    hasil.push(barisKeLaporan(b))
  }
  return hasil.reverse()
}

/** Semua laporan seorang anak (terbaru di atas). */
export async function listLaporanSiswa(nis: string): Promise<DataLaporan[]> {
  const baris = barisValid(await bacaSheet(SHEET.LAPORAN))
  const hasil: DataLaporan[] = []
  for (const b of baris) {
    if (str(b.nilai[LAPORAN_COL.NIS_SISWA]) !== nis.toString()) continue
    hasil.push(barisKeLaporan(b))
  }
  return hasil.reverse()
}

export async function laporanById(id: string): Promise<{ laporan: DataLaporan; rowNumber: number } | null> {
  const baris = barisValid(await bacaSheet(SHEET.LAPORAN))
  for (const b of baris) {
    const laporan = barisKeLaporan(b)
    if (laporan.id === id) return { laporan, rowNumber: b.rowNumber }
  }
  return null
}

export async function simpanLaporan(l: DataLaporan): Promise<void> {
  await appendRows(SHEET.LAPORAN, [laporanKeBaris(l)])
}

export async function updateLaporan(l: DataLaporan): Promise<void> {
  const ketemu = await laporanById(l.id)
  if (!ketemu) throw new Error('Laporan tidak ditemukan.')
  await updateRow(
    SHEET.LAPORAN,
    ketemu.rowNumber,
    LAPORAN_COL.TIMESTAMP,
    laporanKeBaris(l).slice(LAPORAN_COL.TIMESTAMP),
  )
}

export async function hapusLaporan(id: string): Promise<void> {
  const ketemu = await laporanById(id)
  if (!ketemu) throw new Error('Laporan tidak ditemukan.')
  await clearRow(SHEET.LAPORAN, ketemu.rowNumber)
}

export async function setStatusNotifikasi(id: string, status: string): Promise<void> {
  const ketemu = await laporanById(id)
  if (!ketemu) return
  await updateRow(SHEET.LAPORAN, ketemu.rowNumber, LAPORAN_COL.NOTIFIKASI, [status])
}

/** Pastikan laporan lama yang belum punya UUID mendapat Id Laporan. */
export async function pastikanIdLaporan(): Promise<number> {
  const baris = barisValid(await bacaSheet(SHEET.LAPORAN))
  let diperbarui = 0
  for (const b of baris) {
    if (str(b.nilai[LAPORAN_COL.ID])) continue
    await updateRow(SHEET.LAPORAN, b.rowNumber, LAPORAN_COL.ID, [uuid()])
    diperbarui++
  }
  return diperbarui
}

/* ============================== STATISTIK ================================ */

export async function statistik() {
  const [siswa, guru, rombel] = await Promise.all([listSiswa(), listGuru(), listRombel()])
  return {
    siswa: siswa.length,
    siswaAktif: siswa.filter((s) => (s.status || 'Aktif') === 'Aktif').length,
    guru: guru.length,
    rombel: rombel.length,
  }
}