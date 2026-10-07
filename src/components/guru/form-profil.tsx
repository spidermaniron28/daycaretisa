'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Upload, Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import { Bidang } from '@/components/ui/primitives'
import { kompresGambar, ukuranReadable, MAKS_UKURAN_ASLI, labelMaksUkuran } from '@/lib/image'
import { inisial } from '@/lib/utils'
import type { Guru } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Profil guru: ubah data diri + foto profil (di-upload ke Drive).
 * ------------------------------------------------------------------------- */

export function FormProfilGuru({ awal }: { awal: Guru | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nama: awal?.nama ?? '',
    mapel: awal?.mapel ?? '',
    nohp: awal?.nohp ?? '',
    email: awal?.email ?? '',
  })
  const [fotoBaru, setFotoBaru] = useState<{ blob: Blob; nama: string; pratinjau: string } | null>(null)
  const [pratinjau, setPratinjau] = useState(awal?.foto ?? '')
  const [sibuk, setSibuk] = useState(false)
  const [memproses, setMemproses] = useState(false)

  async function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.size > MAKS_UKURAN_ASLI) {
      toast.error(`Foto terlalu besar. Maksimal ${labelMaksUkuran()} sebelum dikompres.`)
      return
    }

    setMemproses(true)
    try {
      const hasil = await kompresGambar(file, 600)
      setFotoBaru({ blob: hasil.blob, nama: hasil.nama, pratinjau: hasil.pratinjau })
      setPratinjau(hasil.pratinjau)
      // Tunjukkan hasil kompresinya supaya jelas berkas besar tidak dikirim apa adanya.
      toast.success(`Foto siap (${ukuranReadable(hasil.ukuranAkhir)} dari ${ukuranReadable(hasil.ukuranAsli)}).`)
    } catch {
      toast.error('Gagal memproses foto.')
    } finally {
      setMemproses(false)
    }
  }

  async function simpan() {
    if (!form.nama.trim()) {
      toast.error('Nama wajib diisi.')
      return
    }

    setSibuk(true)
    try {
      // Foto lama dipertahankan server bila user tidak memilih gambar baru.
      let fotoUrl = awal?.foto ?? ''

      if (fotoBaru) {
        const fd = new FormData()
        fd.append('jenis', 'profil')
        fd.append('files', fotoBaru.blob, fotoBaru.nama)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json()
        if (!up.ok) {
          toast.error(upJson.error ?? 'Gagal mengunggah foto.')
          setSibuk(false)
          return
        }
        fotoUrl = upJson.urls[0]
      }

      const res = await fetch('/api/profil/guru', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nip: awal?.nip ?? '', ...form, fotoUrl }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menyimpan profil.')
        return
      }

      toast.success('Profil berhasil diperbarui.')
      setFotoBaru(null)
      router.refresh()
    } catch {
      toast.error('Gagal terhubung ke server.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="kartu p-6 md:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="shrink-0">
            <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
              {pratinjau ? (
                <img src={pratinjau} alt="Foto profil" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-300" />
              )}
            </div>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={memproses}
              className="tombol-garis w-full mt-3"
            >
              {memproses ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {memproses ? 'Memproses' : 'Ganti Foto'}
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pilihFoto}
            />
          </div>

          <div className="flex-1 w-full space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              {/* Foto terbaru (tersimpan atau baru dipilih) tampil di sini juga,
                  supaya konsisten dengan kotak pratinjau di sebelah kiri. */}
              {pratinjau ? (
                <img
                  src={pratinjau}
                  alt={form.nama || 'Foto profil'}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-[13px] font-bold shrink-0">
                  {inisial(form.nama)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-gray-800 truncate">
                  {form.nama || 'Nama Guru'}
                </p>
                <p className="text-[11px] text-gray-400">NIP: {awal?.nip ?? '-'}</p>
              </div>
            </div>

            <Bidang label="Nama Lengkap" wajib>
              <input
                className="kolom"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </Bidang>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Bidang label="Penugasan / Kelas">
                <input
                  className="kolom"
                  value={form.mapel}
                  onChange={(e) => setForm({ ...form, mapel: e.target.value })}
                  placeholder="mis. Kelas A / Mengasuh"
                />
              </Bidang>
              <Bidang label="No HP">
                <input
                  className="kolom"
                  inputMode="tel"
                  value={form.nohp}
                  onChange={(e) => setForm({ ...form, nohp: e.target.value })}
                />
              </Bidang>
            </div>

            <Bidang label="Email" hint="Dipakai sebagai CC notifikasi laporan.">
              <input
                type="email"
                className="kolom"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Bidang>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t border-gray-100">
          <button type="button" onClick={simpan} disabled={sibuk} className="tombol bg-green-600 hover:bg-green-700 px-8 py-3">
            {sibuk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {sibuk ? 'Menyimpan...' : 'Simpan Profil Saya'}
          </button>
        </div>
      </section>
    </div>
  )
}