/* ---------------------------------------------------------------------------
 * Struktur spreadsheet. Kolom LAMA tidak boleh diubah urutan/namanya supaya
 * data yang sudah ada tetap terbaca; kolom baru selalu ditambahkan di kanan.
 * Semua indeks di bawah 0-based untuk kolom sheet.
 * ------------------------------------------------------------------------- */

export const SHEET = {
  AKUN: 'Akun',
  SISWA: 'Siswa',
  GURU: 'Guru',
  ROMBEL: 'Rombel',
  PENGATURAN: 'Pengaturan',
  LAPORAN: 'Laporan',
} as const

/** Jumlah baris data = lastRow - header. */
export const HEADER_ROW = 1

/* ----------------------------- Akun -------------------------------------- */
/* 0 Role | 1 Username | 2 Password | 3 ID Asli | 4 Nama Lengkap          */
/* 5 PasswordHash (baru) | 6 Dibuat (baru)                               */
export const AKUN_COL = {
  ROLE: 0,
  USERNAME: 1,
  PASSWORD_LAMA: 2,
  ID_ASLI: 3,
  NAMA: 4,
  PASSWORD_HASH: 5,
  DIBUAT: 6,
} as const

export const AKUN_HEADER = [
  'Role',
  'Username',
  'Password',
  'ID Asli',
  'Nama Lengkap',
  'PasswordHash',
  'Dibuat',
]

/* ----------------------------- Siswa ------------------------------------- */
/* 0 NIS | 1 Nama | 2 Kelas | 3 L/P | 4 Status | 5 Foto                    */
/* 6 Email Orang Tua (baru) | 7 No WhatsApp (baru)                          */
export const SISWA_COL = {
  NIS: 0,
  NAMA: 1,
  KELAS: 2,
  JK: 3,
  STATUS: 4,
  FOTO: 5,
  EMAIL_ORTU: 6,
  WA_ORTU: 7,
} as const

export const SISWA_HEADER = [
  'NIS',
  'Nama Lengkap',
  'Kelas',
  'L/P',
  'Status',
  'Foto',
  'Email Orang Tua',
  'No WhatsApp',
]

/* ----------------------------- Guru -------------------------------------- */
/* 0 NIP | 1 Nama | 2 Mapel | 3 No HP | 4 Foto | 5 Email (baru)            */
export const GURU_COL = {
  NIP: 0,
  NAMA: 1,
  MAPEL: 2,
  NOHP: 3,
  FOTO: 4,
  EMAIL: 5,
} as const

export const GURU_HEADER = [
  'NIP',
  'Nama Guru',
  'Mata Pelajaran',
  'No HP',
  'Foto',
  'Email',
]

/* ---------------------------- Rombel ------------------------------------- */
export const ROMBEL_COL = { KODE: 0, NAMA: 1, WALI: 2 } as const
export const ROMBEL_HEADER = ['Kode Kelas', 'Nama Kelas', 'Wali Kelas']

/* -------------------------- Pengaturan ---------------------------------- */
export const PENGATURAN_COL = { KEY: 0, VALUE: 1 } as const
export const PENGATURAN_HEADER = ['Key', 'Value']

/* ---------------------------- Laporan ------------------------------------ */
/* Kolom A..AH = 34 kolom bawaan aplikasi Apps Script lama, urutannya WAJIB
 * dipertahankan karena data lama sudah tersimpan dengan urutan tersebut.
 * 33 Foto Kegiatan | 34 Id Laporan (baru) | 35 Notifikasi (baru)          */
export const LAPORAN_COL = {
  TIMESTAMP: 0,
  TANGGAL: 1,
  NIP_GURU: 2,
  NIS_SISWA: 3,
  DATANG: 4,
  PULANG: 5,
  PENJEMPUT: 6,
  SARAPAN_MENU: 7,
  SARAPAN_HABIS: 8,
  SARAPAN_CAT: 9,
  CAMPAGI_MENU: 10,
  CAMPAGI_HABIS: 11,
  CAMPAGI_CAT: 12,
  SIANG_MENU: 13,
  SIANG_HABIS: 14,
  SIANG_CAT: 15,
  CAMSORE_MENU: 16,
  CAMSORE_HABIS: 17,
  CAMSORE_CAT: 18,
  TIDUR_DATANG: 19,
  TIDUR_BANGUN: 20,
  TIDUR_DURASI: 21,
  TIDUR_KUALITAS: 22,
  SUHU: 23,
  KONDISI: 24,
  BAK_BAB: 25,
  KEBERSIHAN: 26,
  OBAT: 27,
  INTERAKSI: 28,
  KEPATUHAN: 29,
  KEMANDIRIAN: 30,
  MOOD: 31,
  CATATAN: 32,
  FOTO: 33,
  ID: 34,
  NOTIFIKASI: 35,
} as const

export const LAPORAN_TOTAL_KOLOM = 36
export const LAPORAN_HEADER = [
  'Timestamp',
  'Tanggal',
  'NIP Guru',
  'NIS Siswa',
  'Jam Datang',
  'Jam Pulang',
  'Penjemput',
  'Menu Sarapan',
  'Habis Sarapan',
  'Catatan Sarapan',
  'Menu Camilan Pagi',
  'Habis Camilan Pagi',
  'Catatan Camilan Pagi',
  'Menu Makan Siang',
  'Habis Makan Siang',
  'Catatan Makan Siang',
  'Menu Camilan Sore',
  'Habis Camilan Sore',
  'Catatan Camilan Sore',
  'Jam Tidur',
  'Jam Bangun',
  'Durasi Tidur',
  'Kualitas Tidur',
  'Suhu Tubuh',
  'Kondisi Umum',
  'BAK/BAB',
  'Kebersihan Diri',
  'Obat/Vitamin',
  'Interaksi Teman',
  'Kepatuhan',
  'Kemandirian',
  'Mood Anak',
  'Catatan Pengasuh',
  'Foto Kegiatan',
  'Id Laporan',
  'Notifikasi',
]

/* Nilai sentinel yang dipakai UI sebagai "tidak diisi" (sama seperti kode lama). */
export const KOSONG = '-'

export const OPSI_HABIS = ['-', 'Habis (✓)', 'Sisa', 'Tidak Makan'] as const

export const OPSI_KUALITAS_TIDUR = ['Baik', 'Cukup', 'Kurang'] as const

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  guru: 'Guru',
  siswa: 'Orang Tua/Siswa',
}

/**
 * Sandi awal akun yang dibuat otomatis untuk guru / orang tua.
 * Dipakai saat akun dibuat tanpa kata sandi khusus (generate massal maupun
 * otomatis saat data guru/siswa ditambahkan). Pengguna dianjurkan menggantinya
 * setelah login pertama.
 */
export const SANDI_AWAL: Record<'guru' | 'siswa', string> = {
  guru: 'guru12345',
  siswa: 'ortu12345',
}