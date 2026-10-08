'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Upload, Loader2, User, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Bidang } from '@/components/ui/primitives'
import { kompresGambar, ukuranReadable, MAKS_UKURAN_ASLI, labelMaksUkuran } from '@/lib/image'
import type { Siswa } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Profil orang tua: data anak (terkunci), foto profil, kontak, dan ganti sandi.
 * -------------------------------------------------------------------------- */

export function FormProfilOrangTua({ awal }: { awal: Siswa | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [emailOrtu, setEmailOrtu] = useState(awal?.emailOrtu ?? '')
  const [noWa, setNoWa] = useState(awal?.noWhatsapp ?? '')
  const [sandi, setSandi] = useState('')
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
    if (sandi && sandi.length < 8) {
      toast.error('Kata sandi baru minimal 8 karakter.')
      return
    }

    setSibuk(true)
    try {
      let fotoUrl: string | undefined
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

      const res = await fetch('/api/profil/siswa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nis: awal?.nis ?? '',
          nama: awal?.nama ?? '',
          emailOrtu,
          noWhatsapp: noWa,
          passwordBaru: sandi,
          fotoUrl,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menyimpan perubahan.')
        return
      }

      toast.success('Profil berhasil diperbarui.')
      setSandi('')
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
      {/* -------------------------- Data anak -------------------------- */}
      <section className="kartu p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <span className="p-3 bg-blue-50 rounded-lg text-blue-500">
            <User className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Data Anak</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Diisi oleh administrator sekolah. Hubungi sekolah bila perlu diubah.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <InfoKunci label="NIS" nilai={awal?.nis ?? '-'} />
          <InfoKunci label="Nama Lengkap" nilai={awal?.nama ?? '-'} />
          <InfoKunci label="Kelas" nilai={awal?.kelas ?? '-'} />
        </div>
      </section>

      {/* ------------------------ Foto & kontak ------------------------ */}
      <section className="kartu p-6 md:p-8">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="shrink-0">
            <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
              {pratinjau ? (
                <img src={pratinjau} alt="Foto anak" className="w-full h-full object-cover" />
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
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pilihFoto} />
          </div>

          <div className="flex-1 space-y-5">
            <Bidang label="Email Orang Tua" hint="Data kontak orang tua (opsional).">
              <input
                type="email"
                className="kolom"
                value={emailOrtu}
                onChange={(e) => setEmailOrtu(e.target.value)}
                placeholder="ortu@email.com"
              />
            </Bidang>
            <Bidang label="No WhatsApp" hint="Disiapkan untuk notifikasi WhatsApp di masa depan.">
              <input
                className="kolom"
                inputMode="tel"
                value={noWa}
                onChange={(e) => setNoWa(e.target.value)}
                placeholder="0812xxxxxxx"
              />
            </Bidang>
          </div>
        </div>
      </section>

      {/* --------------------------- Sandi ----------------------------- */}
      <section className="kartu p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <span className="p-3 bg-green-50 rounded-lg text-green-500">
            <ShieldCheck className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Keamanan Akun</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Kosongkan bila tidak ingin mengganti kata sandi.
            </p>
          </div>
        </div>

        <Bidang label="Kata Sandi Baru" hint="Minimal 8 karakter.">
          <input
            type="password"
            className="kolom max-w-sm"
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </Bidang>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={simpan} disabled={sibuk} className="tombol bg-blue-700 hover:bg-blue-800 px-8 py-3 w-full sm:w-auto">
          {sibuk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {sibuk ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </div>
  )
}

function InfoKunci({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <label className="kolom-label">{label}</label>
      <input className="kolom bg-gray-50 text-gray-500" value={nilai} readOnly />
    </div>
  )
}