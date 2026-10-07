/* ---------------------------------------------------------------------------
 * Kompresi gambar di browser memakai Canvas.
 *
 * PENTING: ini yang membuat upload ke Drive cukup ringan. Foto HP 4–30 MB
 * dikompres jadi ±150–400 KB sehingga upload di HP dengan sinyal jelek tetap
 * cepat, dan server tidak pernah kewalahan.
 * ------------------------------------------------------------------------- */

const MAKS_DIMENSI = 1200
const KUALITAS = 0.6

/**
 * Batas ukuran berkas ASLI yang boleh dipilih pengguna — dicek SEBELUM dikompres.
 *
 * Angka ini sengaja longgar (30 MB) karena kamera HP zaman sekarang mudah
 * menghasilkan 10–25 MB per foto. Yang dikirim ke server adalah hasil kompresi
 * Canvas (±150–400 KB), bukan berkas aslinya, jadi ukuran besar di sini tidak
 * membebani Drive maupun jaringan.
 */
export const MAKS_UKURAN_ASLI = 30 * 1024 * 1024

/** "30.0 MB" — dipakai di pesan error agar batasnya selalu tampil konsisten. */
export function labelMaksUkuran(): string {
  return ukuranReadable(MAKS_UKURAN_ASLI)
}

export interface HasilKompres {
  blob: Blob
  nama: string
  /** URL siap pakai untuk `<img src>` — berasal dari gambar hasil kompresi. */
  pratinjau: string
  ukuranAsli: number
  ukuranAkhir: number
}

export async function kompresGambar(
  file: File,
  maksDimensi = MAKS_DIMENSI,
): Promise<HasilKompres> {
  /*
   * Berkas asli dibaca lewat object URL, BUKAN data URL base64.
   *
   * Untuk foto 30 MB, data URL berarti string base64 ±40 MB di memori browser —
   * terasa berat di HP, apalagi kalau satu laporan memuat 6 foto. Object URL
   * hanya menunjuk ke berkas di disk sehingga jauh lebih hemat dan lebih cepat.
   */
  const urlAsli = URL.createObjectURL(file)

  try {
    const img = await muatGambar(urlAsli)

    let lebar = img.naturalWidth
    let tinggi = img.naturalHeight

    if (lebar > maksDimensi || tinggi > maksDimensi) {
      const rasio = Math.min(maksDimensi / lebar, maksDimensi / tinggi)
      lebar = Math.round(lebar * rasio)
      tinggi = Math.round(tinggi * rasio)
    }

    const canvas = document.createElement('canvas')
    canvas.width = lebar
    canvas.height = tinggi

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Browser tidak mendukung Canvas.')

    ctx.drawImage(img, 0, 0, lebar, tinggi)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Gagal mengompres gambar.'))),
        'image/jpeg',
        KUALITAS,
      )
    })

    // Kanvas 6000x4000 menahan puluhan MB; lepaskan begitu blob-nya jadi.
    canvas.width = 0
    canvas.height = 0

    return {
      blob,
      nama: `${gantiEkstensi(file.name)}.jpg`,
      // Pratinjau memakai HASIL KOMPRESI (±150–400 KB), bukan berkas asli, supaya
      // menampilkan thumbnail besar tidak menahan gambar 24 megapiksel di memori.
      pratinjau: URL.createObjectURL(blob),
      ukuranAsli: file.size,
      ukuranAkhir: blob.size,
    }
  } finally {
    URL.revokeObjectURL(urlAsli)
  }
}

/** Kompres banyak berkas sekaligus; berkas gagal dilewati, bukan menggagalkan semua. */
export async function kompresBanyak(files: File[]): Promise<HasilKompres[]> {
  const hasil: HasilKompres[] = []
  for (const f of files) {
    try {
      hasil.push(await kompresGambar(f))
    } catch (e) {
      console.warn('[image] gagal mengompres', f.name, e)
    }
  }
  return hasil
}

function muatGambar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Berkas bukan gambar yang valid.'))
    img.src = src
  })
}

function gantiEkstensi(nama: string): string {
  return nama.replace(/\.[^/.]+$/, '')
}

export function ukuranReadable(byte: number): string {
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`
}