'use client'

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import {
  Calendar,
  ChevronDown,
  Utensils,
  Moon,
  Heart,
  Smile,
  Info,
  X,
  Bed,
  Ruler,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KOSONG } from '@/lib/constants'
import type { DataLaporan } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Jurnal harian untuk orang tua.
 *
 * Dua detail yang dipertahankan dari aplikasi lama:
 *  1. Kartu bisa dibuka-tutup (accordion); laporan yang SUDAH dibaca otomatis
 *     dalam keadaan minimize supaya orang tua langsung melihat laporan baru.
 *  2. Lencana "LAPORAN BARU" berubah jadi "Sudah Dibaca" begitu kartu dibuka.
 *
 * Status terbaca disimpan di localStorage per NIS — tidak perlu server, dan
 * tetap tersimpan di HP orang tua setelah menutup browser.
 *
 * Status itu dibaca lewat useSyncExternalStore karena localStorage adalah
 * sumber data DI LUAR React. Membacanya di dalam useEffect + setState akan
 * memicu render berantai, dan juga menyebabkan ketidakcocokan saat SSR.
 * ------------------------------------------------------------------------- */

interface Props {
  laporan: DataLaporan[]
  namaAnak: string
  nis: string
}

const KUNCI_SIMPAN = (nis: string) => `erapor-terbaca-${nis}`
const ACARA_PERUBAHAN = 'erapor:terbaca-berubah'
const KOSONG_SNAPSHOT: readonly string[] = []

/* ------------------------- Store localStorage --------------------------- */

/* getSnapshot wajib mengembalikan referensi yang STABIL, kalau tidak
   useSyncExternalStore akan loop tak terbatas. Karena itu hasil parse
   dicache berdasarkan string mentahnya. */
let cacheMentah: string | null = null
let cacheNilai: readonly string[] = KOSONG_SNAPSHOT

function parse(raw: string | null): readonly string[] {
  if (raw === cacheMentah) return cacheNilai

  let nilai: readonly string[] = KOSONG_SNAPSHOT
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        nilai = parsed.filter((x): x is string => typeof x === 'string')
      }
    } catch {
      nilai = KOSONG_SNAPSHOT
    }
  }

  cacheMentah = raw
  cacheNilai = nilai
  return nilai
}

function subscribeTerbaca(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  window.addEventListener(ACARA_PERUBAHAN, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(ACARA_PERUBAHAN, callback)
  }
}

export function JurnalAnak({ laporan, namaAnak, nis }: Props) {
  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return KOSONG_SNAPSHOT
    return parse(localStorage.getItem(KUNCI_SIMPAN(nis)))
  }, [nis])

  const terbaca = useSyncExternalStore(
    subscribeTerbaca,
    getSnapshot,
    () => KOSONG_SNAPSHOT,
  )

  /** Kartu yang sengaja ditutup user. Yang tidak ada di sini = terbuka. */
  const [sengajaDitutup, setSengajaDitutup] = useState<Set<string>>(() => new Set())
  const [lihatFoto, setLihatFoto] = useState<string | null>(null)

  const terbuka = useMemo(
    () => new Set(laporan.map((l) => l.id).filter((id) => !sengajaDitutup.has(id))),
    [laporan, sengajaDitutup],
  )

  function tandaiDibaca(id: string) {
    try {
      const sekarang = parse(localStorage.getItem(KUNCI_SIMPAN(nis)))
      if (sekarang.includes(id)) return
      localStorage.setItem(KUNCI_SIMPAN(nis), JSON.stringify([...sekarang, id]))
      // Beri tahu(useSyncExternalStore) bahwa sumber datanya berubah.
      window.dispatchEvent(new Event(ACARA_PERUBAHAN))
    } catch {
      // localStorage penuh atau diblokir — status hanya bertahan di sesi ini.
    }
  }

  function toggle(id: string) {
    if (terbuka.has(id)) {
      // Tutup
      setSengajaDitutup((prev) => new Set(prev).add(id))
    } else {
      // Buka + tandai sudah dibaca
      setSengajaDitutup((prev) => {
        const baru = new Set(prev)
        baru.delete(id)
        return baru
      })
      tandaiDibaca(id)
    }
  }

  if (laporan.length === 0) {
    return (
      <div className="kartu p-12 text-center flex flex-col items-center">
        <span className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-5 text-blue-400 shadow-inner">
          <Info className="w-10 h-10" strokeWidth={1.5} />
        </span>
        <h3 className="font-bold text-gray-800 text-lg">Belum Ada Laporan</h3>
        <p className="text-[13.5px] text-gray-500 mt-2 max-w-sm">
          Guru belum menginput perkembangan {namaAnak}. Laporan akan otomatis muncul di sini
          setelah tersimpan di sistem.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-5 max-w-4xl">
        <div className="kartu px-5 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Total laporan
            </p>
            <p className="text-[15px] font-semibold text-gray-800 truncate">{namaAnak}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-gray-800">{laporan.length}</p>
            <p className="text-[11px] text-gray-400">
              {terbaca.filter((id) => laporan.some((l) => l.id === id)).length} sudah dibaca
            </p>
          </div>
        </div>

        {laporan.map((l) => (
          <KartuLaporan
            key={l.id}
            l={l}
            terbuka={terbuka.has(l.id)}
            sudahDibaca={terbaca.includes(l.id)}
            namaAnak={namaAnak}
            onToggle={() => toggle(l.id)}
            onLihatFoto={setLihatFoto}
          />
        ))}
      </div>

      {/* ------------------------------ Lightbox ----------------------------- */}
      {lihatFoto && (
        <div
          className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4 animasi-masuk"
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau foto"
          onClick={() => setLihatFoto(null)}
        >
          <button
            type="button"
            onClick={() => setLihatFoto(null)}
            aria-label="Tutup"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lihatFoto}
            alt="Foto kegiatan"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------------- */

interface KartuProps {
  l: DataLaporan
  terbuka: boolean
  sudahDibaca: boolean
  namaAnak: string
  onToggle: () => void
  onLihatFoto: (url: string) => void
}

function KartuLaporan({
  l,
  terbuka,
  sudahDibaca,
  namaAnak,
  onToggle,
  onLihatFoto,
}: KartuProps) {
  // Bagian pertumbuhan hanya tampil bila laporan ini memuat pengukuran.
  const p = l.pertumbuhan
  const adaPertumbuhan = Boolean(
    p &&
      (p.beratBadan || p.tinggiBadan || p.lingkarKepala || p.interpretasiBB || p.interpretasiTB),
  )
  return (
    <article className="bg-white rounded-2xl shadow-[0_4px_20px_rgb(0_0_0/0.03)] border border-gray-200 overflow-hidden">
      {/* ----------------------------- HEADER ----------------------------- */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={terbuka}
        className="w-full bg-gradient-to-r from-[#1e3a8a] to-[#3b82f6] p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden text-left hover:opacity-95 transition-opacity"
      >
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 -mr-4 -mt-4" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        </div>

        <div className="flex items-center gap-4 relative z-10 w-full sm:w-auto">
          <span className="bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-inner flex-shrink-0">
            <Calendar className="w-6 h-6 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-blue-200 uppercase tracking-widest mb-0.5">
              Jurnal Perkembangan
            </p>
            <h3 className="font-bold text-white text-base md:text-lg drop-shadow-sm truncate">
              {l.tanggal}
            </h3>
            <p className="text-[11px] text-blue-200 truncate sm:hidden">{namaAnak}</p>
          </div>
        </div>

        <div className="flex items-center justify-between w-full sm:w-auto gap-3 relative z-10 border-t border-white/10 sm:border-t-0 pt-3 sm:pt-0">
          {sudahDibaca ? (
            <span className="bg-slate-400/80 text-white px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide shadow-sm">
              Sudah Dibaca
            </span>
          ) : (
            <span className="bg-red-500 text-white px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide shadow-sm animasi-denyut">
              LAPORAN BARU
            </span>
          )}

          <span
            className="bg-white/20 p-1 rounded-md text-white transition-transform duration-300"
            style={{ transform: terbuka ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <ChevronDown className="w-5 h-5" />
          </span>
        </div>
      </button>

      {/* ------------------------------ BODY ------------------------------ */}
      {terbuka && (
        <div className="p-5 md:p-8 space-y-8 animasi-masuk">
          {/* Kehadiran */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50 rounded-xl border border-gray-100 p-2 shadow-sm">
            <div className="flex flex-col items-center justify-center p-3 text-center">
              <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">
                Datang
              </span>
              <span className="font-bold text-gray-800 text-[17px]">{l.datang}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-3 text-center">
              <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">
                Pulang
              </span>
              <span className="font-bold text-gray-800 text-[17px]">{l.pulang}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-3 text-center">
              <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">
                Penjemput
              </span>
              <span className="font-bold text-gray-800 text-[13px] truncate w-full px-1" title={l.penjemput}>
                {l.penjemput}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Asupan */}
            <div className="space-y-4">
              <JudikBagian judul="Asupan Nutrisi" ikon={<Utensils className="w-4 h-4" />} warna="orange" />
              <div className="space-y-3">
                {([
                  ['Sarapan Pagi', l.sarapan],
                  ['Camilan Pagi', l.campagi],
                  ['Makan Siang', l.siang],
                  ['Camilan Sore', l.camsore],
                ] as const).map(([judul, m]) => (
                  <div
                    key={judul}
                    className="flex items-start justify-between bg-white border border-gray-100 p-3 rounded-xl shadow-sm hover:border-orange-200 transition-colors"
                  >
                    <div className="pr-3 min-w-0">
                      <p className="text-[12px] font-bold text-gray-700 mb-0.5">{judul}</p>
                      <p className="text-[13px] text-gray-600 font-medium">{nilai(m.menu)}</p>
                      {m.catatan !== KOSONG && (
                        <p className="text-[11px] text-gray-400 mt-1 italic">{m.catatan}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 pt-1">{lencanaPorsi(m.habis)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              {/* Tidur */}
              <div className="space-y-4">
                <JudikBagian judul="Istirahat Siang" ikon={<Moon className="w-4 h-4" />} warna="indigo" />
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 grid grid-cols-2 gap-4 shadow-sm">
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-50 text-center">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                      <Bed className="w-3 h-3 inline mr-1" />
                      Mulai Tidur
                    </p>
                    <p className="text-[15px] font-bold text-gray-800">{nilai(l.tidur.datang)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-50 text-center">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                      Bangun
                    </p>
                    <p className="text-[15px] font-bold text-gray-800">{nilai(l.tidur.bangun)}</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-between px-2 pt-1">
                    <div className="text-[12px]">
                      <span className="text-gray-400 font-medium">Durasi:</span>{' '}
                      <span className="font-bold text-gray-700">{nilai(l.tidur.durasi)}</span>
                    </div>
                    <div className="text-[12px]">
                      <span className="text-gray-400 font-medium">Kualitas:</span>{' '}
                      <span className="font-bold text-gray-700">{nilai(l.tidur.kualitas)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kesehatan */}
              <div className="space-y-4">
                <JudikBagian judul="Kesehatan & Kebersihan" ikon={<Heart className="w-4 h-4" />} warna="rose" />
                <div className="grid grid-cols-2 gap-3">
                  <KotakInfo label="Suhu Tubuh" isi={l.kesehatan.suhu} />
                  <KotakInfo label="Kondisi" isi={l.kesehatan.kondisi} />
                  <KotakInfo label="BAK / BAB" isi={l.kesehatan.bakBab} />
                  <KotakInfo label="Kebersihan" isi={l.kesehatan.kebersihan} />
                  <div className="col-span-2 flex items-start gap-2.5 bg-rose-50/50 p-3 rounded-xl border border-rose-100 shadow-sm">
                    <Heart className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-0.5">
                        Obat / Vitamin
                      </p>
                      <p className="text-[13px] text-gray-700 font-medium">{nilai(l.kesehatan.obat)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pertumbuhan & Perkembangan (hanya tampil bila diukur hari itu) */}
          {adaPertumbuhan && (
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <JudikBagian
                judul="Pertumbuhan & Perkembangan"
                ikon={<Ruler className="w-4 h-4" />}
                warna="green"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KotakInfo
                  label="Berat Badan"
                  isi={l.pertumbuhan.beratBadan ? `${l.pertumbuhan.beratBadan} kg` : ''}
                />
                <KotakInfo
                  label="Tinggi Badan"
                  isi={l.pertumbuhan.tinggiBadan ? `${l.pertumbuhan.tinggiBadan} cm` : ''}
                />
                <KotakInfo
                  label="Lingkar Kepala"
                  isi={l.pertumbuhan.lingkarKepala ? `${l.pertumbuhan.lingkarKepala} cm` : ''}
                />
                {l.pertumbuhan.interpretasiBB && (
                  <TafsirInfo label="Interpretasi (BB)" tafsir={l.pertumbuhan.interpretasiBB} />
                )}
                {l.pertumbuhan.interpretasiTB && (
                  <TafsirInfo label="Interpretasi (TB)" tafsir={l.pertumbuhan.interpretasiTB} />
                )}
              </div>
            </div>
          )}

          {/* Perilaku */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <JudikBagian judul="Perilaku & Interaksi Sosial" ikon={<Smile className="w-4 h-4" />} warna="purple" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KotakInfo label="Interaksi Teman" isi={l.perilaku.interaksi} />
              <KotakInfo label="Kepatuhan" isi={l.perilaku.kepatuhan} />
              <KotakInfo label="Kemandirian" isi={l.perilaku.kemandirian} />
              <KotakInfo label="Mood Anak" isi={l.perilaku.mood} />
            </div>
          </div>

          {/* Catatan */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 relative overflow-hidden shadow-sm">
            <div className="absolute -right-4 -bottom-6 text-amber-500/10">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <div className="flex items-center gap-2 mb-2.5 relative z-10">
              <Info className="w-4 h-4 text-amber-500" />
              <h4 className="font-bold text-amber-700 text-[13px] uppercase tracking-wide">
                Catatan Pengasuh
              </h4>
            </div>
            <p className="text-gray-700 text-[13.5px] leading-relaxed relative z-10">
              {nilai(l.perilaku.catatanPengasuh)}
            </p>
          </div>

          {/* Foto */}
          {l.fotoKegiatan.length > 0 && (
            <div className="space-y-3">
              <JudikBagian judul="Foto Kegiatan" ikon={<Calendar className="w-4 h-4" />} warna="blue" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {l.fotoKegiatan.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onLihatFoto(url)}
                    className="rounded-lg overflow-hidden border border-gray-200 aspect-[4/3] hover:border-blue-300 transition-colors group"
                  >
                    <img
                      src={url}
                      alt={`Foto kegiatan ${i + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

/* ------------------------------ Potongan -------------------------------- */

function nilai(v: string) {
  return !v || v === KOSONG ? (
    <span className="text-gray-300 italic text-[11px]">Belum diisi</span>
  ) : (
    v
  )
}

function lencanaPorsi(status: string) {
  if (!status || status === KOSONG) return <span className="text-gray-300 text-xs font-medium">-</span>
  if (status.includes('Habis'))
    return (
      <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase shadow-sm">
        Habis
      </span>
    )
  if (status.includes('Sisa'))
    return (
      <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase shadow-sm">
        Sisa
      </span>
    )
  return (
    <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase shadow-sm">
      {status}
    </span>
  )
}

const WARNA_JUDIK: Record<string, string> = {
  orange: 'border-orange-100',
  indigo: 'border-indigo-100',
  rose: 'border-rose-100',
  purple: 'border-purple-100',
  blue: 'border-blue-100',
  green: 'border-emerald-100',
}

const WARNA_IKON: Record<string, string> = {
  orange: 'bg-orange-100 text-orange-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  rose: 'bg-rose-100 text-rose-600',
  purple: 'bg-purple-100 text-purple-600',
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-emerald-100 text-emerald-600',
}

function JudikBagian({
  judul,
  ikon,
  warna,
}: {
  judul: string
  ikon: React.ReactNode
  warna: keyof typeof WARNA_JUDIK
}) {
  return (
    <div className={cn('flex items-center gap-2.5 border-b pb-2', WARNA_JUDIK[warna])}>
      <span className={cn('p-1.5 rounded-md', WARNA_IKON[warna])}>{ikon}</span>
      <h4 className="font-bold text-gray-800 text-[14px]">{judul}</h4>
    </div>
  )
}

function KotakInfo({ label, isi }: { label: string; isi: string }) {
  return (
    <div className="flex flex-col bg-gray-50 border border-gray-100 p-3 rounded-xl">
      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
        {label}
      </span>
      <span className="text-[13px] font-semibold text-gray-700">{nilai(isi)}</span>
    </div>
  )
}

/** Hasil interpretasi pertumbuhan — hijau bila aman, merah bila perlu perhatian. */
function TafsirInfo({ label, tafsir }: { label: string; tafsir: string }) {
  const aman = /normal|tinggi/i.test(tafsir)
  return (
    <div
      className={cn(
        'flex flex-col border p-3 rounded-xl',
        aman ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100',
      )}
    >
      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
        {label}
      </span>
      <span
        className={cn(
          'text-[13px] font-semibold',
          aman ? 'text-emerald-600' : 'text-red-500',
        )}
      >
        {tafsir}
      </span>
    </div>
  )
}