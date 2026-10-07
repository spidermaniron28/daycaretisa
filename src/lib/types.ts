/* ---------------------------------------------------------------------------
 * Domain types untuk E-Rapor Daycare.
 * Struktur kolom spreadsheet ada di ./constants.ts — jangan diubah diam-diam.
 * ------------------------------------------------------------------------- */

export type Role = 'admin' | 'guru' | 'siswa'

export interface Akun {
  role: Role
  username: string
  /** ID asli: NIP untuk guru, NIS untuk siswa. Di-link ke sheet Guru/Siswa. */
  idAsli: string
  namaLengkap: string
  /** true = password sudah berupa hash scrypt, false = masih plaintext lama. */
  passwordTerhash: boolean
  dibuat: string
}

export interface Siswa {
  nis: string
  nama: string
  kelas: string
  jk: string
  status: string
  foto: string
  emailOrtu: string
  noWhatsapp: string
  tanggalLahir: string
}

export interface Guru {
  nip: string
  nama: string
  mapel: string
  nohp: string
  foto: string
  email: string
}

export interface Rombel {
  kode: string
  nama: string
  wali: string
}

export type PengaturanKey =
  | 'nama_sekolah'
  | 'teks_pengumuman'
  | 'tp_berjalan'
  | 'logo_url'
  | 'bg_kiri_url'
  | 'bg_luar_url'
  | 'teks_motivasi'
  | 'teks_pengumuman_guru'
  | 'teks_bantuan'
  | 'email_notifikasi_aktif'
  /** "YA" bila app Google sudah dipublikasikan (In production) — lihat StatusDrive. */
  | 'drive_dipublikasikan'

export type Pengaturan = Record<string, string>

export interface MekanismeMakan {
  menu: string
  habis: string
  catatan: string
}

export interface DataLaporan {
  /** UUID stabil — menggantikan row_id berbasis nomor baris yang rawan geser. */
  id: string
  tanggal: string
  guruNip: string
  nis: string
  datang: string
  pulang: string
  penjemput: string
  sarapan: MekanismeMakan
  campagi: MekanismeMakan
  siang: MekanismeMakan
  camsore: MekanismeMakan
  tidur: { datang: string; bangun: string; durasi: string; kualitas: string }
  kesehatan: {
    suhu: string
    kondisi: string
    bakBab: string
    kebersihan: string
    obat: string
  }
  pertumbuhan: {
    beratBadan: string
    interpretasiBB: string
    tinggiBadan: string
    interpretasiTB: string
    lingkarKepala: string
  }
  perilaku: {
    interaksi: string
    kepatuhan: string
    kemandirian: string
    mood: string
    catatanPengasuh: string
  }
  fotoKegiatan: string[]
  /** 'TERKIRIM' | 'GAGAL' | '' */
  notifikasi: string
  /** ISO timestamp, hanya diisi saat membuat. */
  dibuat: string
}

/** Bentuk laporan yang dilihat orang tua (sudah diisi nama guru). */
export interface LaporanUntukOrangTua extends DataLaporan {
  guru: string
  namaAnak: string
}

/** Isi cookie session. */
export interface SessionPayload {
  role: Role
  username: string
  idAsli: string
  namaLengkap: string
  foto: string
}

export interface ApiError {
  error: string
}

/* ----------------------------- Status koneksi ----------------------------- */
/* Dipakai halaman admin (Sistem & Akses) — lihat src/lib/kesehatan.ts.       */

export interface StatusSheets {
  ok: boolean
  pesan: string
}

export interface StatusDrive {
  ok: boolean
  /** Email akun Google yang terhubung (pemilik folder foto). */
  akun: string
  dibuatPada: string | null
  umurTokenHari: number | null
  pesan: string
  /**
   * true bila admin sudah menandai app Google sebagai "In production".
   * Hanya berlaku sebagai penanda: Google tidak menyediakan API untuk membaca
   * status publishing OAuth consent screen.
   */
  dipublikasikan: boolean
  /**
   * Token sudah berumur > 5 hari DAN app belum ditandai dipublikasikan — waspada
   * aturan kedaluwarsa 7 hari milik Google.
   */
  mendekatiKedaluwarsa: boolean
}

export interface StatusKoneksi {
  diperiksaPada: string
  sheets: StatusSheets
  drive: StatusDrive
  perintahHubungkanUlang: string
}

export interface HasilUjiTulis {
  ok: boolean
  rincian: Array<{ folder: string; tulis: boolean; hapus: boolean; pesan: string }>
}