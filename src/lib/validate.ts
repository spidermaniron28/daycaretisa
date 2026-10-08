import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from './password'

/* ---------------------------------------------------------------------------
 * Skema validasi. Dipakai di server sebagai batas terakhir sebelum data
 * menyentuh spreadsheet.
 * ------------------------------------------------------------------------- */

const teks = z.string().trim().max(500)
const teksPendek = z.string().trim().max(120)

export const roleSchema = z.enum(['admin', 'guru', 'siswa'])

export const loginSchema = z.object({
  role: roleSchema,
  username: teksPendek.min(1, 'Username wajib diisi.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.').max(200),
})

const porsiMakan = z.object({
  menu: teks,
  habis: teksPendek,
  catatan: teks,
})

export const laporanSchema = z.object({
  id: teksPendek.optional(),
  tanggal: z.string().min(1, 'Tanggal wajib diisi.'),
  guruNip: teksPendek,
  nis: teksPendek.min(1, 'Pilih siswa.'),
  datang: teksPendek,
  pulang: teksPendek,
  penjemput: teks,
  sarapan: porsiMakan,
  campagi: porsiMakan,
  siang: porsiMakan,
  camsore: porsiMakan,
  tidur: z.object({
    datang: teksPendek,
    bangun: teksPendek,
    durasi: teksPendek,
    kualitas: teksPendek,
  }),
  kesehatan: z.object({
    suhu: teksPendek,
    kondisi: teks,
    bakBab: teks,
    kebersihan: teks,
    obat: teks,
  }),
  /** Pengukuran pertumbuhan (opsional — hanya diisi saat ada penimbangan). */
  pertumbuhan: z
    .object({
      beratBadan: teksPendek.default(''),
      interpretasiBB: teksPendek.default(''),
      tinggiBadan: teksPendek.default(''),
      interpretasiTB: teksPendek.default(''),
      lingkarKepala: teksPendek.default(''),
    })
    .default({
      beratBadan: '',
      interpretasiBB: '',
      tinggiBadan: '',
      interpretasiTB: '',
      lingkarKepala: '',
    }),
  perilaku: z.object({
    interaksi: teks,
    kepatuhan: teks,
    kemandirian: teks,
    mood: teks,
    catatanPengasuh: teks,
  }),
  fotoKegiatan: z.array(z.url()).max(6).default([]),
})

/*
 * akunUsername & akunPassword: opsional, hanya dipakai saat MEMBUAT data baru.
 * Kalau kosong, akun login dibuat otomatis memakai NIS/NIP sebagai username dan
 * sandi awal per peran. Nilainya diabaikan saat data diubah (PATCH).
 */
const akunOtomatis = {
  akunUsername: teksPendek.default(''),
  akunPassword: z.string().max(200).default(''),
}

export const siswaSchema = z.object({
  nis: teksPendek.min(1, 'NIS wajib diisi.'),
  nama: z.string().trim().min(1, 'Nama wajib diisi.').max(200),
  kelas: teksPendek.min(1, 'Kelas wajib diisi.'),
  jk: z.enum(['L', 'P']),
  status: z.enum(['Aktif', 'Nonaktif']).default('Aktif'),
  emailOrtu: z.union([z.email('Format email tidak valid.'), z.literal('')]).default(''),
  noWhatsapp: teksPendek.default(''),
  /** Format YYYY-MM-DD; kosong = belum diisi. Dipakai hitung usia untuk
   *  interpretasi berat/tinggi badan (standar WHO). */
  tanggalLahir: teksPendek.default(''),
  ...akunOtomatis,
})

export const guruSchema = z.object({
  nip: teksPendek.min(1, 'NIP wajib diisi.'),
  nama: z.string().trim().min(1, 'Nama wajib diisi.').max(200),
  mapel: teks.max(200).default(''),
  nohp: teksPendek.default(''),
  email: z.union([z.email('Format email tidak valid.'), z.literal('')]).default(''),
  ...akunOtomatis,
})

export const rombelSchema = z.object({
  kode: teksPendek.min(1, 'Kode kelas wajib diisi.'),
  nama: z.string().trim().min(1, 'Nama kelas wajib diisi.').max(200),
  wali: z.string().trim().max(200).default(''),
})

export const akunSchema = z.object({
  role: roleSchema,
  username: teksPendek.min(1, 'Username wajib diisi.'),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`).max(200),
  nama: z.string().trim().max(200).optional(),
})

export const pengaturanSchema = z.object({
  nama_sekolah: teks.max(200).default(''),
  teks_pengumuman: teks.max(500).default(''),
  tp_berjalan: teksPendek.max(60).default(''),
  teks_motivasi: teks.max(500).default(''),
  teks_pengumuman_guru: teks.max(500).default(''),
  teks_bantuan: teks.max(500).default(''),
  logo_url: z.union([z.url(), z.literal('')]).default(''),
  bg_kiri_url: z.union([z.url(), z.literal('')]).default(''),
  bg_luar_url: z.union([z.url(), z.literal('')]).default(''),
})

export const saranSchema = z.object({
  pesan: z.string().trim().min(3, 'Tuliskan saran minimal 3 karakter.').max(2000),
})

export const profilGuruSchema = z.object({
  nip: teksPendek,
  nama: z.string().trim().min(1, 'Nama wajib diisi.').max(200),
  mapel: teks.max(200).default(''),
  nohp: teksPendek.default(''),
  email: z.union([z.email('Format email tidak valid.'), z.literal('')]).default(''),
})

export const profilSiswaSchema = z.object({
  nis: teksPendek,
  nama: z.string().trim().max(200).default(''),
  emailOrtu: z.union([z.email('Format email tidak valid.'), z.literal('')]).default(''),
  noWhatsapp: teksPendek.default(''),
  passwordBaru: z
    .union([z.literal(''), z.string().min(MIN_PASSWORD_LENGTH, `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`)])
    .default(''),
})

export type LaporanInput = z.infer<typeof laporanSchema>
export type SiswaInput = z.infer<typeof siswaSchema>
export type GuruInput = z.infer<typeof guruSchema>
export type RombelInput = z.infer<typeof rombelSchema>