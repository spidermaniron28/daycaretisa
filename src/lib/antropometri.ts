/* ---------------------------------------------------------------------------
 * Interpretasi antropometri anak (BB, TB) berdasarkan usia.
 * Standar WHO/Kemenkes untuk anak usia 0-5 tahun.
 *
 * Murni perhitungan — tidak ada rahasia, aman dipakai di client (pratinjau
 * langsung di form guru) sekaligus server (simpanan otoritatif).
 * ------------------------------------------------------------------------- */

/**
 * Hitung usia dalam bulan dari tanggal lahir sampai tanggal pengukuran.
 */
export function hitungUsiaBulan(tanggalLahir: string, tanggalUkur: string): number {
  const lahir = new Date(tanggalLahir)
  const ukur = new Date(tanggalUkur)
  
  const tahun = ukur.getFullYear() - lahir.getFullYear()
  const bulan = ukur.getMonth() - lahir.getMonth()
  const hari = ukur.getDate() - lahir.getDate()
  
  let totalBulan = tahun * 12 + bulan
  if (hari < 0) totalBulan-- // Belum genap sebulan
  
  return Math.max(0, totalBulan)
}

/**
 * Format usia untuk ditampilkan, mis. "2 tahun 3 bulan" atau "8 bulan".
 */
export function formatUsia(usiaBulan: number): string {
  const tahun = Math.floor(usiaBulan / 12)
  const bulan = usiaBulan % 12
  
  if (tahun === 0) return `${bulan} bulan`
  if (bulan === 0) return `${tahun} tahun`
  return `${tahun} tahun ${bulan} bulan`
}

/**
 * Interpretasi berat badan berdasarkan usia (BB/U).
 * Standar WHO untuk anak 0-60 bulan.
 */
export function interpretasiBB(
  beratKg: number,
  usiaBulan: number,
  jenisKelamin: 'L' | 'P'
): string {
  const standar = getStandarBB(usiaBulan, jenisKelamin)
  if (!standar) return 'Data tidak tersedia'

  const { bawah, atas } = standar
  // Kategori = posisi terhadap -2 SD (kurang) dan +2 SD (berlebih).
  if (beratKg < bawah) return 'Berat badan kurang'
  if (beratKg > atas) return 'Berat badan lebih'
  return 'Berat badan normal'
}

/**
 * Interpretasi tinggi badan berdasarkan usia (TB/U).
 */
export function interpretasiTB(
  tinggiCm: number,
  usiaBulan: number,
  jenisKelamin: 'L' | 'P'
): string {
  const standar = getStandarTB(usiaBulan, jenisKelamin)
  if (!standar) return 'Data tidak tersedia'

  const { bawah, atas } = standar
  // Posisi terhadap -2 SD (pendek/stunting) dan +2 SD (tinggi).
  if (tinggiCm < bawah) return 'Pendek (stunting)'
  if (tinggiCm > atas) return 'Tinggi'
  return 'Normal'
}

/* ----------------------------- Standar WHO -------------------------------- */
/* Nilai simplified - dalam produksi sebenarnya pakai tabel lengkap WHO      */
/* atau API Kemenkes. Ini cukup untuk daycare usia 1-5 tahun.                */

interface StandarAntro {
  bawah: number // -2 SD
  median: number // 0 SD
  atas: number // +2 SD
}

/* ---------------------------------------------------------------------------
 * Median WHO yang dipakai (aproksimasi linier per segmen, titik simpul = nilai
 * median WHO pada usia 0/6/12/24/36/48/60 bulan):
 *
 * BB (kg) L: 3.3 · 7.9 · 9.6 · 12.2 · 14.3 · 16.3 · 18.2
 * BB (kg) P: 3.2 · 7.3 · 8.9 · 11.5 · 13.7 · 15.6 · 17.5
 * TB (cm) L: 49.9 · 67.3 · 75.7 · 87.1 · 95.1 · 101.5 · 107.1
 * TB (cm) P: 49.0 · 65.8 · 74.0 · 85.7 · 93.6 · 99.9 · 105.7
 * ------------------------------------------------------------------------- */

const TITIK_USIA = [0, 6, 12, 24, 36, 48, 60] as const
const MEDIAN_BB_L = [3.3, 7.9, 9.6, 12.2, 14.3, 16.3, 18.2]
const MEDIAN_BB_P = [3.2, 7.3, 8.9, 11.5, 13.7, 15.6, 17.5]
const MEDIAN_TB_L = [49.9, 67.3, 75.7, 87.1, 95.1, 101.5, 107.1]
const MEDIAN_TB_P = [49.0, 65.8, 74.0, 85.7, 93.6, 99.9, 105.7]

/** Interpolasi linier antar titik simpul median WHO. */
function medianAntara(usiaBulan: number, seri: number[]): number {
  for (let i = 1; i < TITIK_USIA.length; i++) {
    if (usiaBulan <= TITIK_USIA[i]) {
      const u0 = TITIK_USIA[i - 1]
      const u1 = TITIK_USIA[i]
      const t = (usiaBulan - u0) / (u1 - u0)
      return seri[i - 1] + t * (seri[i] - seri[i - 1])
    }
  }
  return seri[seri.length - 1]
}

function getStandarBB(usiaBulan: number, jk: 'L' | 'P'): StandarAntro | null {
  if (usiaBulan < 0 || usiaBulan > 60) return null
  const median = medianAntara(usiaBulan, jk === 'L' ? MEDIAN_BB_L : MEDIAN_BB_P)
  // Batas -2 SD & +2 SD (persentase khas kurva BB anak).
  return { bawah: median * 0.82, median, atas: median * 1.2 }
}

function getStandarTB(usiaBulan: number, jk: 'L' | 'P'): StandarAntro | null {
  if (usiaBulan < 0 || usiaBulan > 60) return null
  const median = medianAntara(usiaBulan, jk === 'L' ? MEDIAN_TB_L : MEDIAN_TB_P)
  // Batas -2 SD & +2 SD (±6% pada kurva TB anak).
  return { bawah: median * 0.94, median, atas: median * 1.06 }
}

/** Parse input desimal yang bisa memakai koma ("7,4"). */
export function parseAngka(v: string): number | null {
  const n = parseFloat((v || '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Bentuk data pertumbuhan sebagaimana disimpan di sheet Laporan. */
export interface DataPertumbuhan {
  beratBadan: string
  interpretasiBB: string
  tinggiBadan: string
  interpretasiTB: string
  lingkarKepala: string
}

/**
 * Hitung ulang interpretasi BB/TB di sisi server saat laporan disimpan —
 * nilai tersimpan selalu berasal dari tanggal lahir & jenis kelamin terkini
 * di sheet Siswa (klien tidak bisa memalsukan).
 */
export function interpretasiSimpan(
  p: DataPertumbuhan,
  anak: { tanggalLahir?: string; jk?: string } | null | undefined,
  tanggalUkur: string,
): DataPertumbuhan {
  if (!anak?.tanggalLahir || !tanggalUkur) return p
  const hasil = interpretasiLengkap(
    anak.tanggalLahir,
    tanggalUkur,
    anak.jk === 'P' ? 'P' : 'L',
    parseAngka(p.beratBadan),
    parseAngka(p.tinggiBadan),
  )
  return {
    ...p,
    interpretasiBB: hasil.interpretasiBB ?? '',
    interpretasiTB: hasil.interpretasiTB ?? '',
  }
}

/**
 * Interpretasi lengkap untuk ditampilkan.
 */
export function interpretasiLengkap(
  tanggalLahir: string,
  tanggalUkur: string,
  jenisKelamin: 'L' | 'P',
  beratKg: number | null,
  tinggiCm: number | null
): {
  usiaBulan: number
  usiaLabel: string
  interpretasiBB: string | null
  interpretasiTB: string | null
} {
  const usiaBulan = hitungUsiaBulan(tanggalLahir, tanggalUkur)
  const usiaLabel = formatUsia(usiaBulan)
  
  return {
    usiaBulan,
    usiaLabel,
    interpretasiBB: beratKg ? interpretasiBB(beratKg, usiaBulan, jenisKelamin) : null,
    interpretasiTB: tinggiCm ? interpretasiTB(tinggiCm, usiaBulan, jenisKelamin) : null,
  }
}
