'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Clock, Utensils, Moon, Heart, Smile, ImagePlus, X, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Bidang } from '@/components/ui/primitives'
import {
  kompresBanyak,
  ukuranReadable,
  MAKS_UKURAN_ASLI,
  labelMaksUkuran,
  type HasilKompres,
} from '@/lib/image'
import { cn } from '@/lib/utils'
import { OPSI_HABIS, OPSI_KUALITAS_TIDUR } from '@/lib/constants'
import type { DataLaporan, Siswa } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Form input laporan harian anak.
 *
 * Menggantikan ~40 input ID di aplikasi lama. Foto dikompres di browser lalu
 * diunggah multipart ke Drive, bukan base64 lewat google.script.run.
 * ------------------------------------------------------------------------- */

interface Props {
  siswa: Siswa[]
  /** NIP guru yang sedang login. */
  nipGuru: string
  /** Data lama saat mode edit. */
  awal?: DataLaporan | null
  kirimEmailDefault: boolean
}

const MEAL: Array<{ key: 'sarapan' | 'campagi' | 'siang' | 'camsore'; judul: string }> = [
  { key: 'sarapan', judul: 'Sarapan Pagi' },
  { key: 'campagi', judul: 'Camilan Pagi' },
  { key: 'siang', judul: 'Makan Siang' },
  { key: 'camsore', judul: 'Camilan Sore' },
]

function formKosong(nip: string): DataLaporan {
  return {
    id: '',
    dibuat: '',
    tanggal: new Date().toISOString().slice(0, 10),
    guruNip: nip,
    nis: '',
    datang: '',
    pulang: '',
    penjemput: '',
    sarapan: { menu: '', habis: '-', catatan: '' },
    campagi: { menu: '', habis: '-', catatan: '' },
    siang: { menu: '', habis: '-', catatan: '' },
    camsore: { menu: '', habis: '-', catatan: '' },
    tidur: { datang: '', bangun: '', durasi: '', kualitas: 'Baik' },
    kesehatan: { suhu: '', kondisi: '', bakBab: '', kebersihan: '', obat: '' },
    perilaku: { interaksi: '', kepatuhan: '', kemandirian: '', mood: '', catatanPengasuh: '' },
    fotoKegiatan: [],
    notifikasi: '',
  }
}

export function FormLaporan({ siswa, nipGuru, awal, kirimEmailDefault }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<DataLaporan>(() =>
    awal ? normalisasi(awal) : formKosong(nipGuru),
  )
  const [fotoBaru, setFotoBaru] = useState<HasilKompres[]>([])
  const [kirimEmail, setKirimEmail] = useState(kirimEmailDefault)
  const [sibuk, setSibuk] = useState(false)
  const [memprosesFoto, setMemprosesFoto] = useState(false)

  const anakAktif = siswa.find((s) => s.nis === form.nis)
  const modeEdit = Boolean(awal?.id)

  /* ----------------------------- pembantu ------------------------------ */

  function ubah<K extends keyof DataLaporan>(key: K, nilai: DataLaporan[K]) {
    setForm((f) => ({ ...f, [key]: nilai }))
  }

  function ubahMekanisme(
    sesi: 'sarapan' | 'campagi' | 'siang' | 'camsore',
    field: 'menu' | 'habis' | 'catatan',
    nilai: string,
  ) {
    setForm((f) => ({ ...f, [sesi]: { ...f[sesi], [field]: nilai } }))
  }

  function ubahKelompok(
    kelompok: 'tidur' | 'kesehatan' | 'perilaku',
    field: string,
    nilai: string,
  ) {
    setForm((f) => ({
      ...f,
      [kelompok]: { ...f[kelompok], [field]: nilai },
    }))
  }

  async function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    const total = fotoBaru.length + form.fotoKegiatan.length + files.length
    if (total > 6) {
      toast.error('Maksimal 6 foto dalam satu laporan.')
      return
    }

    // Foto asli boleh besar (kamera HP mudah 10–25 MB); yang dikirim ke server
    // adalah hasil kompresi Canvas, jadi batasnya pun longgar.
    const kegedean = files.find((f) => f.size > MAKS_UKURAN_ASLI)
    if (kegedean) {
      toast.error(
        `Foto "${kegedean.name}" terlalu besar. Maksimal ${labelMaksUkuran()} sebelum dikompres.`,
      )
      return
    }

    setMemprosesFoto(true)
    try {
      const hasil = await kompresBanyak(files)
      if (hasil.length === 0) {
        toast.error('Tidak ada foto yang bisa diproses.')
        return
      }
      setFotoBaru((f) => [...f, ...hasil])
      toast.success(
        `${hasil.length} foto dikompres (${ukuranReadable(hasil.reduce((a, b) => a + b.ukuranAkhir, 0))}).`,
      )
    } catch {
      toast.error('Gagal memproses foto.')
    } finally {
      setMemprosesFoto(false)
    }
  }

  function hapusFotoLama(url: string) {
    setForm((f) => ({ ...f, fotoKegiatan: f.fotoKegiatan.filter((u) => u !== url) }))
  }

  /* ------------------------------ simpan -------------------------------- */

  async function simpan() {
    if (!form.nis) {
      toast.error('Pilih anak terlebih dahulu.')
      return
    }
    if (!form.tanggal || !form.datang || !form.pulang) {
      toast.error('Tanggal, jam datang, dan jam pulang wajib diisi.')
      return
    }

    setSibuk(true)
    try {
      // 1. Unggah foto baru lebih dulu; laporan menunjuk URL hasil unggahan.
      let fotoKegiatan = form.fotoKegiatan
      if (fotoBaru.length > 0) {
        const fd = new FormData()
        // Masuk ke folder Drive "FOTO KEGIATAN", terpisah dari foto profil.
        fd.append('jenis', 'kegiatan')
        for (const f of fotoBaru) fd.append('files', f.blob, f.nama)

        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upJson = await up.json()
        if (!up.ok) {
          toast.error(upJson.error ?? 'Gagal mengunggah foto.')
          setSibuk(false)
          return
        }
        fotoKegiatan = [...fotoKegiatan, ...(upJson.urls as string[])]
      }

      // 2. Simpan laporan dengan URL foto final.
      const res = await fetch(`/api/laporan${kirimEmail ? '?kirimEmail=1' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, guruNip: form.guruNip || nipGuru, fotoKegiatan }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menyimpan laporan.')
        setSibuk(false)
        return
      }

      if (json.notifikasi?.terkirim) {
        toast.success('Laporan tersimpan dan email orang tua berhasil dikirim.')
      } else if (json.notifikasi?.pesan) {
        toast.success(`Laporan tersimpan, tapi email gagal: ${json.notifikasi.pesan}`)
      } else {
        toast.success('Laporan berhasil disimpan!')
      }

      setFotoBaru([])
      router.refresh()

      if (!modeEdit) {
        setForm(formKosong(nipGuru))
      }
    } catch {
      toast.error('Gagal terhubung ke server. Coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  /* ------------------------------ tampilan ------------------------------ */

  const siswaAktif = siswa.filter((s) => (s.status || 'Aktif') === 'Aktif')

  return (
    <div className="space-y-6 max-w-4xl">
      {modeEdit && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-[13px]">
          <Save className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Mode ubah laporan.</p>
            <p className="mt-0.5">
              Perubahan akan menimpa laporan yang sudah tersimpan. Foto yang tidak dihapus akan
              tetap dipakai.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------- Kehadiran ------------------------- */}
      <Panel judul="Data Kehadiran" ikon={<Clock className="w-4 h-4" />} warna="blue">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Bidang label="Tanggal Laporan" wajib>
            <input
              type="date"
              className="kolom"
              value={form.tanggal}
              onChange={(e) => ubah('tanggal', e.target.value)}
              required
            />
          </Bidang>

          <Bidang label="Pilih Anak" wajib>
            <select
              className="kolom"
              value={form.nis}
              onChange={(e) => ubah('nis', e.target.value)}
              required
            >
              <option value="">-- Pilih Anak --</option>
              {siswaAktif.map((s) => (
                <option key={s.nis} value={s.nis}>
                  {s.nis} — {s.nama} ({s.kelas})
                </option>
              ))}
            </select>
          </Bidang>
        </div>

        {anakAktif && (
          <p className="text-[12px] text-gray-500 mt-3">
            Kelas <strong className="text-gray-700">{anakAktif.kelas}</strong>
            {anakAktif.emailOrtu ? (
              <>
                {' '}· Email orang tua: <strong className="text-gray-700">{anakAktif.emailOrtu}</strong>
              </>
            ) : (
              <span className="text-amber-600"> · Email orang tua belum diisi, notifikasi tidak bisa dikirim.</span>
            )}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <Bidang label="Jam Datang" wajib>
            <input type="time" className="kolom" value={form.datang} onChange={(e) => ubah('datang', e.target.value)} required />
          </Bidang>
          <Bidang label="Jam Pulang" wajib>
            <input type="time" className="kolom" value={form.pulang} onChange={(e) => ubah('pulang', e.target.value)} required />
          </Bidang>
          <Bidang label="Penjemput" wajib hint="mis. Ibu, Ayah, atau nama wali">
            <input
              className="kolom"
              value={form.penjemput}
              onChange={(e) => ubah('penjemput', e.target.value)}
              placeholder="mis. Ibu"
            />
          </Bidang>
        </div>
      </Panel>

      {/* --------------------------- Makan ---------------------------- */}
      <Panel judul="Makan & Minum" ikon={<Utensils className="w-4 h-4" />} warna="orange">
        <div className="space-y-4">
          {MEAL.map(({ key, judul }) => (
            <div key={key} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              <label className="md:col-span-3 text-[13px] font-semibold text-gray-700 pt-2.5">
                {judul}
              </label>

              <input
                className="kolom md:col-span-4"
                placeholder="Menu..."
                value={form[key].menu}
                onChange={(e) => ubahMekanisme(key, 'menu', e.target.value)}
              />

              <select
                className="kolom md:col-span-2"
                value={form[key].habis}
                onChange={(e) => ubahMekanisme(key, 'habis', e.target.value)}
                aria-label={`Porsi habis ${judul}`}
              >
                {OPSI_HABIS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>

              <input
                className="kolom md:col-span-3"
                placeholder="Catatan (opsional)"
                value={form[key].catatan}
                onChange={(e) => ubahMekanisme(key, 'catatan', e.target.value)}
              />
            </div>
          ))}
        </div>
      </Panel>

      {/* --------------------------- Tidur ---------------------------- */}
      <Panel judul="Istirahat Siang" ikon={<Moon className="w-4 h-4" />} warna="indigo">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Bidang label="Mulai Tidur">
            <input type="time" className="kolom" value={form.tidur.datang} onChange={(e) => ubahKelompok('tidur', 'datang', e.target.value)} />
          </Bidang>
          <Bidang label="Bangun">
            <input type="time" className="kolom" value={form.tidur.bangun} onChange={(e) => ubahKelompok('tidur', 'bangun', e.target.value)} />
          </Bidang>
          <Bidang label="Durasi" hint="mis. 1 jam 30 menit">
            <input className="kolom" value={form.tidur.durasi} onChange={(e) => ubahKelompok('tidur', 'durasi', e.target.value)} />
          </Bidang>
          <Bidang label="Kualitas">
            <select
              className="kolom"
              value={form.tidur.kualitas}
              onChange={(e) => ubahKelompok('tidur', 'kualitas', e.target.value)}
            >
              {OPSI_KUALITAS_TIDUR.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Bidang>
        </div>
      </Panel>

      {/* -------------------------- Kesehatan ------------------------- */}
      <Panel judul="Kesehatan & Kebersihan" ikon={<Heart className="w-4 h-4" />} warna="rose">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Bidang label="Suhu Tubuh" hint="mis. 36.5">
            <input className="kolom" value={form.kesehatan.suhu} onChange={(e) => ubahKelompok('kesehatan', 'suhu', e.target.value)} />
          </Bidang>
          <Bidang label="Kondisi Umum">
            <input className="kolom" placeholder="mis. Baik" value={form.kesehatan.kondisi} onChange={(e) => ubahKelompok('kesehatan', 'kondisi', e.target.value)} />
          </Bidang>
          <Bidang label="BAK / BAB">
            <input className="kolom" placeholder="mis. 1x BAK" value={form.kesehatan.bakBab} onChange={(e) => ubahKelompok('kesehatan', 'bakBab', e.target.value)} />
          </Bidang>
          <Bidang label="Kebersihan Diri">
            <input className="kolom" placeholder="mis. Mandi sendiri" value={form.kesehatan.kebersihan} onChange={(e) => ubahKelompok('kesehatan', 'kebersihan', e.target.value)} />
          </Bidang>
          <Bidang label="Obat / Vitamin" className="md:col-span-2">
            <input className="kolom" placeholder="Kosongkan bila tidak ada" value={form.kesehatan.obat} onChange={(e) => ubahKelompok('kesehatan', 'obat', e.target.value)} />
          </Bidang>
        </div>
      </Panel>

      {/* --------------------------- Perilaku ------------------------- */}
      <Panel judul="Perilaku & Interaksi Sosial" ikon={<Smile className="w-4 h-4" />} warna="purple">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Bidang label="Interaksi dengan Teman">
            <input className="kolom" placeholder="mis. Sangat baik" value={form.perilaku.interaksi} onChange={(e) => ubahKelompok('perilaku', 'interaksi', e.target.value)} />
          </Bidang>
          <Bidang label="Kepatuhan">
            <input className="kolom" placeholder="mis. Mengikuti instruksi" value={form.perilaku.kepatuhan} onChange={(e) => ubahKelompok('perilaku', 'kepatuhan', e.target.value)} />
          </Bidang>
          <Bidang label="Kemandirian">
            <input className="kolom" placeholder="mis. Makan sendiri" value={form.perilaku.kemandirian} onChange={(e) => ubahKelompok('perilaku', 'kemandirian', e.target.value)} />
          </Bidang>
          <Bidang label="Mood Anak">
            <input className="kolom" placeholder="mis. Ceria" value={form.perilaku.mood} onChange={(e) => ubahKelompok('perilaku', 'mood', e.target.value)} />
          </Bidang>
          <Bidang label="Catatan Pengasuh" className="md:col-span-2" hint="Ceritakan hal penting hari ini untuk orang tua.">
            <textarea rows={3} className="kolom" value={form.perilaku.catatanPengasuh} onChange={(e) => ubahKelompok('perilaku', 'catatanPengasuh', e.target.value)} />
          </Bidang>
        </div>
      </Panel>

      {/* ----------------------------- Foto ---------------------------- */}
      <Panel judul="Foto Kegiatan" ikon={<ImagePlus className="w-4 h-4" />} warna="blue">
        <p className="text-[12px] text-gray-500 mb-4">
          Maksimal 6 foto, masing-masing sampai {labelMaksUkuran()}. Foto dikompres otomatis di
          perangkat sebelum diunggah ke Google Drive, jadi ukuran kirimannya tetap kecil.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {form.fotoKegiatan.map((url, i) => (
            <figure key={url} className="relative rounded-lg overflow-hidden border border-gray-200 aspect-[4/3] bg-gray-50">
              <img src={url} alt={`Foto lama ${i + 1}`} className="w-full h-full object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 text-center font-medium">
                Tersimpan
              </span>
              <button
                type="button"
                onClick={() => hapusFotoLama(url)}
                aria-label="Hapus foto ini"
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </figure>
          ))}

          {fotoBaru.map((f, i) => (
            <figure key={`${f.nama}-${i}`} className="relative rounded-lg overflow-hidden border border-green-300 aspect-[4/3] bg-green-50">
              <img src={f.pratinjau} alt={`Foto baru ${i + 1}`} className="w-full h-full object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-green-600/90 text-white text-[10px] p-1 text-center font-medium">
                Baru · {ukuranReadable(f.ukuranAkhir)}
              </span>
              <button
                type="button"
                onClick={() => setFotoBaru((arr) => arr.filter((_, idx) => idx !== i))}
                aria-label="Hapus foto baru ini"
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </figure>
          ))}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={memprosesFoto}
            className="rounded-lg border-2 border-dashed border-gray-300 aspect-[4/3] flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-60"
          >
            {memprosesFoto ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-[11px]">Memproses...</span>
              </>
            ) : (
              <>
                <ImagePlus className="w-5 h-5" />
                <span className="text-[11px]">Tambah Foto</span>
              </>
            )}
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={pilihFoto}
        />
      </Panel>

      {/* ---------------------------- Simpan --------------------------- */}
      <div className="kartu p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={kirimEmail}
            onChange={(e) => setKirimEmail(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500"
          />
          <span className="text-[13px] text-gray-700">
            Kirim ringkasan laporan ke email orang tua
          </span>
        </label>

        <button type="button" onClick={simpan} disabled={sibuk} className="tombol bg-green-600 hover:bg-green-700 px-8 py-3 w-full sm:w-auto">
          {sibuk ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : kirimEmail ? (
            <Send className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {sibuk ? 'Menyimpan...' : 'Simpan Laporan Lengkap'}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------ Potongan -------------------------------- */

const WARNA_PANEL: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-500',
  orange: 'bg-orange-100 text-orange-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  rose: 'bg-rose-100 text-rose-600',
  purple: 'bg-purple-100 text-purple-600',
}

function Panel({
  judul,
  ikon,
  warna,
  children,
}: {
  judul: string
  ikon: React.ReactNode
  warna: keyof typeof WARNA_PANEL
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden cetak-pecah">
      <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
        <h3 className={cn('text-[14px] font-bold text-gray-800 flex items-center gap-2')}>
          <span className={cn('w-6 h-6 rounded-md flex items-center justify-center', WARNA_PANEL[warna])}>
            {ikon}
          </span>
          {judul}
        </h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

/** Pastikan nilai '-' tidak ikut tersimpan untuk field bebas teks. */
function normalisasi(l: DataLaporan): DataLaporan {
  const bersih = (v: string) => (v === '-' ? '' : v)
  return {
    ...l,
    sarapan: { ...l.sarapan, menu: bersih(l.sarapan.menu), catatan: bersih(l.sarapan.catatan) },
    campagi: { ...l.campagi, menu: bersih(l.campagi.menu), catatan: bersih(l.campagi.catatan) },
    siang: { ...l.siang, menu: bersih(l.siang.menu), catatan: bersih(l.siang.catatan) },
    camsore: { ...l.camsore, menu: bersih(l.camsore.menu), catatan: bersih(l.camsore.catatan) },
    tidur: { ...l.tidur, durasi: bersih(l.tidur.durasi) },
    kesehatan: {
      ...l.kesehatan,
      suhu: bersih(l.kesehatan.suhu),
      kondisi: bersih(l.kesehatan.kondisi),
      bakBab: bersih(l.kesehatan.bakBab),
      kebersihan: bersih(l.kesehatan.kebersihan),
      obat: bersih(l.kesehatan.obat),
    },
    perilaku: {
      ...l.perilaku,
      interaksi: bersih(l.perilaku.interaksi),
      kepatuhan: bersih(l.perilaku.kepatuhan),
      kemandirian: bersih(l.perilaku.kemandirian),
      mood: bersih(l.perilaku.mood),
      catatanPengasuh: bersih(l.perilaku.catatanPengasuh),
    },
  }
}