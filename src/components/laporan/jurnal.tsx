'use client'

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { Calendar, ChevronDown, Info } from 'lucide-react'
import type { DataLaporan } from '@/lib/types'
import { DetailLaporan, type InfoGuru } from './detail-laporan'

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
  /** Data guru penginput per laporan (kunci = id laporan). */
  guruPerLaporan?: Record<string, InfoGuru | undefined>
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

export function JurnalAnak({ laporan, namaAnak, nis, guruPerLaporan = {} }: Props) {
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

  const terbuka = useMemo(
    () => new Set(laporan.map((l) => l.id).filter((id) => !sengajaDitutup.has(id))),
    [laporan, sengajaDitutup],
  )

  function tandaiDibaca(id: string) {
    try {
      const sekarang = parse(localStorage.getItem(KUNCI_SIMPAN(nis)))
      if (sekarang.includes(id)) return
      localStorage.setItem(KUNCI_SIMPAN(nis), JSON.stringify([...sekarang, id]))
      // Beri tahu (useSyncExternalStore) bahwa sumber datanya berubah.
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
          guru={guruPerLaporan[l.id]}
          onToggle={() => toggle(l.id)}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------------- */

interface KartuProps {
  l: DataLaporan
  terbuka: boolean
  sudahDibaca: boolean
  namaAnak: string
  guru?: InfoGuru
  onToggle: () => void
}

function KartuLaporan({ l, terbuka, sudahDibaca, namaAnak, guru, onToggle }: KartuProps) {
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
        <div className="p-5 md:p-8 animasi-masuk">
          <DetailLaporan l={l} guru={guru ?? null} />
        </div>
      )}
    </article>
  )
}
