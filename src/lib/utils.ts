import { KOSONG } from './constants'

/* ---------------------------------------------------------------------------
 * Utilitas kecil yang dipakai lintas modul.
 * ------------------------------------------------------------------------- */

/** Ubah nilai sheet (yang bisa null/undefined) menjadi string aman untuk UI. */
export function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

/** Sama seperti str() tapi memakai '-' sebagai pengganti kosong (kode lama memakai ini). */
export function strOrDash(v: unknown): string {
  const s = str(v)
  return s === '' ? KOSONG : s
}

export function uuid(): string {
  return crypto.randomUUID()
}

/** Format angka dengan pemisah ribuan, aman untuk nilai non-number. */
export function angka(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n
  if (!Number.isFinite(v)) return String(n ?? '')
  return new Intl.NumberFormat('id-ID').format(v)
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Label pilihan kelas: "<kode> — <nama>".
 * Bila kode dan nama sama (mis. kelas tunggal "Daycare"), cukup tampilkan
 * sekali supaya tidak terbaca "Daycare — Daycare".
 */
export function labelKelas(kode: string, nama: string): string {
  const k = kode.trim()
  const n = nama.trim()
  if (!k) return n
  if (!n || k.localeCompare(n, undefined, { sensitivity: 'base' }) === 0) return k
  return `${k} — ${n}`
}

export function inisial(nama: string): string {
  return nama.trim().charAt(0).toUpperCase() || '?'
}

/* --------------------------- Usia & kelas -------------------------------- */
/*
 * Kelas daycare ditentukan oleh usia anak (dalam bulan). Rentang usia dibaca
 * dari nama/kode kelas itu sendiri, mis. "Daycare 1 bln - 12 bln" => 1..12.
 * Dengan begitu kelas baru yang ditambahkan admin (mis. "Daycare 43 bln -
 * 60 bln") ikut terbaca otomatis tanpa perlu mengubah kode.
 */

/** Rentang usia (bulan) dari nama kelas. Null bila tidak ada polanya. */
export function rentangUsiaKelas(nama: string): { min: number; max: number } | null {
  const cocok = nama.match(/\d+/g)
  if (!cocok || cocok.length < 2) return null
  const min = Number(cocok[0])
  const max = Number(cocok[cocok.length - 1])
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return null
  return { min, max }
}

/**
 * Usia dalam bulan penuh pada tanggal acuan (default: hari ini).
 * Menerima format ISO "YYYY-MM-DD" (nilai <input type="date">).
 * Null bila tanggal kosong/tidak valid atau masih di masa depan.
 */
export function usiaBulan(tanggalLahir: string, acuan: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggalLahir.trim())
  if (!m) return null
  const th = Number(m[1])
  const bl = Number(m[2])
  const hr = Number(m[3])
  if (bl < 1 || bl > 12 || hr < 1 || hr > 31) return null
  let bulan = (acuan.getFullYear() - th) * 12 + (acuan.getMonth() + 1 - bl)
  if (acuan.getDate() < hr) bulan -= 1
  return bulan < 0 ? null : bulan
}

/**
 * Kelas yang cocok untuk usia anak pada tanggal lahir tertentu.
 *
 * Anak yang belum genap 1 bulan (usia 0) diarahkan ke kelas termuda agar
 * tetap mendapat kelas. Bila usianya melewati kelas tertinggi, hasilnya null
 * supaya UI bisa memperingatkan alih-alih menebak kelas yang salah.
 */
export function kelasDariUsia(
  tanggalLahir: string,
  rombel: ReadonlyArray<{ kode: string; nama: string }>,
): { kode: string; usia: number } | null {
  const usia = usiaBulan(tanggalLahir)
  if (usia === null) return null

  const berentang = rombel
    .map((r) => ({ r, rentang: rentangUsiaKelas(r.nama || r.kode) }))
    .filter((x): x is { r: { kode: string; nama: string }; rentang: { min: number; max: number } } => x.rentang !== null)
    .sort((a, b) => a.rentang.min - b.rentang.min)

  if (berentang.length === 0) return null

  const cocok = berentang.find((x) => usia >= x.rentang.min && usia <= x.rentang.max)
  if (cocok) return { kode: cocok.r.kode, usia }
  if (usia < berentang[0].rentang.min) return { kode: berentang[0].r.kode, usia }
  return null
}

/** Ambil nilai pertama yang tidak kosong. */
export function pertama<T>(...args: Array<T | undefined | null>): T {
  for (const a of args) {
    if (a !== undefined && a !== null) return a
  }
  return args[0] as T
}

/** Validasi format email sederhana. */
export function emailValid(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
}

/* ------------------------ Penomoran kode otomatis ------------------------ */
/*
 * Guru memakai NIP "GURU-<n>", siswa memakai NIS "SISWA-<n>". Nomor yang dipakai
 * selalu yang terkecil dan masih kosong, jadi kode tetap berurutan walau ada
 * data yang dihapus di tengah.
 */

export const PREFIX_NIP_GURU = 'GURU-'
export const PREFIX_NIS_SISWA = 'SISWA-'

/** Ambil nomor urut dari nilai berformat "<awalan><n>". Null bila bukan format itu. */
function nomorUrut(awalan: string, nilai: string): number | null {
  const teks = nilai.trim().toUpperCase()
  if (!teks.startsWith(awalan)) return null
  const angka = teks.slice(awalan.length)
  if (!/^\d+$/.test(angka)) return null
  const n = Number(angka)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Kode berikutnya: nomor terkecil yang belum dipakai. Nilai non-standar dilewati. */
function kodeBerikutnya(awalan: string, terpakai: Iterable<string>): string {
  const dipakai = new Set<number>()
  for (const nilai of terpakai) {
    const n = nomorUrut(awalan, nilai)
    if (n !== null) dipakai.add(n)
  }
  let n = 1
  while (dipakai.has(n)) n++
  return `${awalan}${n}`
}

/** Urutkan menaik; kode non-standar dilempar ke bawah agar urutannya stabil. */
function bandingkanKode(awalan: string, a: string, b: string): number {
  const na = nomorUrut(awalan, a)
  const nb = nomorUrut(awalan, b)
  if (na !== null && nb !== null) return na - nb
  if (na !== null) return -1
  if (nb !== null) return 1
  return a.localeCompare(b)
}

/** Ambil nomor urut dari NIP "GURU-<n>". Null bila formatnya bukan itu. */
export function nomorNipGuru(nip: string): number | null {
  return nomorUrut(PREFIX_NIP_GURU, nip)
}

/**
 * NIP guru berikutnya: nomor terkecil yang belum dipakai.
 *
 * Kalau GURU-2 dihapus sementara GURU-1 dan GURU-3 masih ada, hasilnya
 * GURU-2 lagi — jadi nomornya selalu berurutan dan lubang tidak menganggur.
 */
export function nipGuruBerikutnya(nipTerpakai: Iterable<string>): string {
  return kodeBerikutnya(PREFIX_NIP_GURU, nipTerpakai)
}

/** Urutkan NIP menaik; NIP non-standar dilempar ke bawah agar tetap stabil. */
export function bandingkanNipGuru(a: string, b: string): number {
  return bandingkanKode(PREFIX_NIP_GURU, a, b)
}

/** Ambil nomor urut dari NIS "SISWA-<n>". Null bila formatnya bukan itu. */
export function nomorNisSiswa(nis: string): number | null {
  return nomorUrut(PREFIX_NIS_SISWA, nis)
}

/** NIS siswa berikutnya: nomor terkecil yang belum dipakai (lubang dipakai ulang). */
export function nisSiswaBerikutnya(nisTerpakai: Iterable<string>): string {
  return kodeBerikutnya(PREFIX_NIS_SISWA, nisTerpakai)
}

/** Urutkan NIS menaik; NIS non-standar dilempar ke bawah agar tetap stabil. */
export function bandingkanNisSiswa(a: string, b: string): number {
  return bandingkanKode(PREFIX_NIS_SISWA, a, b)
}