'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Upload, X, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Bidang } from '@/components/ui/primitives'
import type { Pengaturan } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Pengaturan Sistem & Akses.
 *
 * Gambar (logo, background) di-upload ke Google Drive sebagai multipart, bukan
 * base64 seperti di aplikasi lama yang sering gagal karena limit payload.
 * ------------------------------------------------------------------------- */

type GambarKey = 'logo' | 'bg-kiri' | 'bg-luar'

const KONFIG_GAMBAR: Array<{
  key: GambarKey
  setting: 'logo_url' | 'bg_kiri_url' | 'bg_luar_url'
  label: string
  saran: string
  accept: string
}> = [
  { key: 'logo', setting: 'logo_url', label: 'Logo Sekolah', saran: 'PNG/SVG transparan, sekitar 256×256 px.', accept: 'image/png,image/jpeg,image/webp' },
  { key: 'bg-kiri', setting: 'bg_kiri_url', label: 'Background Panel Login', saran: 'Potrait, 800×1000 px.', accept: 'image/png,image/jpeg,image/webp' },
  { key: 'bg-luar', setting: 'bg_luar_url', label: 'Background Luar', saran: 'Landscape, 1920×1080 px.', accept: 'image/png,image/jpeg,image/webp' },
]

export function FormPengaturan({ awal }: { awal: Pengaturan }) {
  const router = useRouter()
  const [teks, setTeks] = useState({
    nama_sekolah: awal.nama_sekolah ?? '',
    teks_pengumuman: awal.teks_pengumuman ?? '',
    tp_berjalan: awal.tp_berjalan ?? '',
    teks_motivasi: awal.teks_motivasi ?? '',
    teks_pengumuman_guru: awal.teks_pengumuman_guru ?? '',
    teks_bantuan: awal.teks_bantuan ?? '',
    email_notifikasi_aktif: awal.email_notifikasi_aktif ?? 'TIDAK',
  })
  const [gambar, setGambar] = useState<Record<GambarKey, string>>({
    logo: awal.logo_url ?? '',
    'bg-kiri': awal.bg_kiri_url ?? '',
    'bg-luar': awal.bg_luar_url ?? '',
  })
  const [sibuk, setSibuk] = useState(false)
  const [unggah, setUnggah] = useState<Record<GambarKey, boolean>>({
    logo: false,
    'bg-kiri': false,
    'bg-luar': false,
  })

  async function unggahGambar(key: GambarKey, file: File) {
    setUnggah((u) => ({ ...u, [key]: true }))
    try {
      const fd = new FormData()
      // Logo & background bukan foto kegiatan — tetap di folder foto profil.
      fd.append('jenis', 'profil')
      fd.append('files', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal mengunggah gambar.')
        return
      }
      setGambar((g) => ({ ...g, [key]: json.urls[0] }))
      toast.success('Gambar berhasil diunggah. Klik Simpan untuk menerapkan.')
    } catch {
      toast.error('Gagal mengunggah gambar.')
    } finally {
      setUnggah((u) => ({ ...u, [key]: false }))
    }
  }

  async function simpan() {
    setSibuk(true)
    try {
      const res = await fetch('/api/pengaturan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...teks, ...gambar }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menyimpan pengaturan.')
        return
      }
      toast.success('Pengaturan berhasil disimpan.')
      router.refresh()
    } catch {
      toast.error('Gagal terhubung ke server.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ------------------------- Identitas sekolah ------------------------- */}
      <section className="kartu p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <span className="p-3 bg-blue-50 rounded-lg text-blue-500">
            <ImageIcon className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Identitas Sekolah</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Nama dan pengumuman tampil di halaman login.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Bidang label="Nama Sekolah" wajib>
            <input
              className="kolom"
              value={teks.nama_sekolah}
              onChange={(e) => setTeks({ ...teks, nama_sekolah: e.target.value })}
            />
          </Bidang>
          <Bidang label="Tahun Pelajaran Berjalan" wajib>
            <input
              className="kolom"
              value={teks.tp_berjalan}
              onChange={(e) => setTeks({ ...teks, tp_berjalan: e.target.value })}
            />
          </Bidang>
        </div>

        <div className="mt-6">
          <Bidang label="Pengumuman di Halaman Login" wajib>
            <input
              className="kolom"
              value={teks.teks_pengumuman}
              onChange={(e) => setTeks({ ...teks, teks_pengumuman: e.target.value })}
            />
          </Bidang>
        </div>
      </section>

      {/* ------------------------------ Gambar ------------------------------ */}
      <section className="kartu p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <span className="p-3 bg-violet-50 rounded-lg text-violet-500">
            <Upload className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Gambar & Logo</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Disimpan ke folder Google Drive. Biarkan kosong bila tidak ingin mengganti.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {KONFIG_GAMBAR.map(({ key, setting, ...cfg }) => (
            <BidangGambar
              key={key}
              setting={setting}
              label={cfg.label}
              saran={cfg.saran}
              accept={cfg.accept}
              url={gambar[key]}
              sibuk={unggah[key]}
              onPilih={(file) => unggahGambar(key, file)}
              onHapus={() => setGambar((v) => ({ ...v, [key]: '' }))}
            />
          ))}
        </div>
      </section>

      {/* --------------------------- Teks portal guru ------------------------ */}
      <section className="kartu p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <span className="p-3 bg-green-50 rounded-lg text-green-500">
            <Save className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Teks Beranda Guru</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Motivasi, pengumuman, dan bantuan yang tampil di portal guru.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <Bidang label="Motivasi / Deskripsi (kartu atas)" wajib>
            <textarea
              rows={2}
              className="kolom"
              value={teks.teks_motivasi}
              onChange={(e) => setTeks({ ...teks, teks_motivasi: e.target.value })}
            />
          </Bidang>
          <Bidang label="Pengumuman Guru (kartu hijau)" wajib>
            <textarea
              rows={2}
              className="kolom"
              value={teks.teks_pengumuman_guru}
              onChange={(e) => setTeks({ ...teks, teks_pengumuman_guru: e.target.value })}
            />
          </Bidang>
          <Bidang label="Bantuan Sistem (kartu biru)" wajib>
            <textarea
              rows={2}
              className="kolom"
              value={teks.teks_bantuan}
              onChange={(e) => setTeks({ ...teks, teks_bantuan: e.target.value })}
            />
          </Bidang>
        </div>
      </section>

      {/* ---------------------------- Notifikasi ---------------------------- */}
      <section className="kartu p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <span className="p-3 bg-amber-50 rounded-lg text-amber-500">
            <Save className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Notifikasi Email</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Ringkasan laporan harian dikirim otomatis ke email orang tua.
            </p>
          </div>
        </div>

        <Bidang
          label="Kirim email setelah guru menyimpan laporan"
          hint="Server tetap harus punya SMTP_HOST, SMTP_USER, dan SMTP_PASS di environment."
        >
          <select
            className="kolom max-w-xs"
            value={teks.email_notifikasi_aktif}
            onChange={(e) => setTeks({ ...teks, email_notifikasi_aktif: e.target.value })}
          >
            <option value="TIDAK">Tidak — simpan saja</option>
            <option value="YA">Ya — kirim ringkasan ke orang tua</option>
          </select>
        </Bidang>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={simpan} disabled={sibuk} className="tombol bg-blue-800 hover:bg-blue-900 px-8 py-3">
          <Save className="w-4 h-4" />
          {sibuk ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  )
}

function BidangGambar({
  label,
  saran,
  accept,
  url,
  sibuk,
  onPilih,
  onHapus,
}: {
  setting: string
  label: string
  saran: string
  accept: string
  url: string
  sibuk: boolean
  onPilih: (file: File) => void
  onHapus: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div>
      <label className="kolom-label">{label}</label>

      {url ? (
        <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50 mb-2 aspect-video">
          <img src={url} alt={label} className="w-full h-full object-contain" />
          <button
            type="button"
            onClick={onHapus}
            aria-label={`Hapus ${label}`}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={sibuk}
          className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors mb-2"
        >
          <Upload className="w-6 h-6" />
          <span className="text-[12px]">{sibuk ? 'Mengunggah...' : 'Pilih gambar'}</span>
        </button>
      )}

      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPilih(f)
          e.target.value = ''
        }}
      />

      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={sibuk}
        className="tombol-garis w-full"
      >
        <Upload className="w-3.5 h-3.5" />
        {sibuk ? 'Mengunggah...' : url ? 'Ganti Gambar' : 'Unggah Gambar'}
      </button>

      <p className="text-[11px] text-gray-400 mt-1.5">{saran}</p>
    </div>
  )
}