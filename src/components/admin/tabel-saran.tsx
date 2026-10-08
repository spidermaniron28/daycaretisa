'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { Kosong } from '@/components/ui/primitives'
import type { Saran } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Daftar saran & masukan untuk admin.
 *
 * Begitu halaman ini dibuka, semua saran berstatus BARU ditandai sudah
 * dibaca (POST /api/saran/tandai) sehingga lencana notifikasi merah di
 * sidebar ikut hilang. Nama pemberi saran tampil lengkap beserta kelasnya.
 * ------------------------------------------------------------------------- */

function formatWaktu(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TabelSaran({ awal }: { awal: Saran[] }) {
  const router = useRouter()
  const sudahDikirim = useRef(false)
  // Setelah POST tandai sukses, daftar langsung diperbarui dari sisi klien
  // (tanpa menunggu data segar dari server) supaya admin tidak melihat
  // status "Baru" yang tertinggal saat cache router masih basi.
  const [sudahDitandai, setSudahDitandai] = useState(false)
  const baruAwal = awal.filter((s) => s.status === 'BARU').length
  const baru = sudahDitandai ? 0 : baruAwal

  useEffect(() => {
    if (sudahDikirim.current || sudahDitandai || baruAwal === 0) return
    sudahDikirim.current = true
    fetch('/api/saran/tandai', { method: 'POST' })
      .then((r) => {
        if (r.ok) {
          setSudahDitandai(true)
          router.refresh()
        } else {
          sudahDikirim.current = false
        }
      })
      .catch(() => {
        // Biarkan lencana tetap ada — percobaan berikutnya saat halaman dibuka lagi.
        sudahDikirim.current = false
      })
  }, [sudahDitandai, baruAwal, router])

  return (
    <div className="space-y-5 max-w-4xl">
      {/* ---------------------------- Ringkasan --------------------------- */}
      <div className="kartu p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="p-2.5 bg-amber-50 rounded-lg text-amber-500 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Saran &amp; Masukan Orang Tua
            </p>
            <p className="text-[15px] font-semibold text-gray-800">{awal.length} masukan masuk</p>
          </div>
        </div>
        {baru > 0 && (
          <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
            {baru} belum dibaca
          </span>
        )}
      </div>

      {/* ------------------------------ Daftar ---------------------------- */}
      {awal.length === 0 ? (
        <Kosong
          judul="Belum ada saran & masukan"
          pesan="Saran dari orang tua akan muncul di sini begitu dikirim lewat portal Orang Tua."
        />
      ) : (
        <ul className="space-y-4">
          {awal.map((s) => (
            <li key={s.id} className="kartu p-5">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                  {s.nama.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-gray-800 truncate">
                    {s.nama || s.nis}
                  </p>
                  <p className="text-[11.5px] text-gray-500">
                    {s.kelas ? `${s.kelas} · ` : ''}NIS {s.nis}
                  </p>
                </div>
                <span
                  className={
                    (sudahDitandai ? 'DIBACA' : s.status) === 'BARU'
                      ? 'text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded uppercase tracking-wide'
                      : 'text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded uppercase tracking-wide'
                  }
                >
                  {(sudahDitandai ? 'DIBACA' : s.status) === 'BARU' ? 'Baru' : 'Sudah dibaca'}
                </span>
                <span className="text-[11.5px] text-gray-400 shrink-0" suppressHydrationWarning>
                  {formatWaktu(s.waktu)}
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-[13.5px] text-gray-700 whitespace-pre-wrap break-words">
                  {s.pesan}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
