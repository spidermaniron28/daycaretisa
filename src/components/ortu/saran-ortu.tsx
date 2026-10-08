'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Bidang } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import type { Saran } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Menu Saran & Masukan di portal orang tua.
 *
 * Orang tua menulis masukan → tersimpan di sheet Saran dengan status BARU →
 * muncul lencana notifikasi merah di sidebar admin.
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

export function SaranOrtu({ awal }: { awal: Saran[] }) {
  const router = useRouter()
  const [pesan, setPesan] = useState('')
  const [sibuk, setSibuk] = useState(false)

  async function kirim() {
    const isi = pesan.trim()
    if (isi.length < 3) {
      toast.error('Tuliskan saran minimal 3 karakter.')
      return
    }

    setSibuk(true)
    try {
      const res = await fetch('/api/saran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pesan: isi }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal mengirim saran.')
        return
      }
      setPesan('')
      toast.success('Terima kasih! Saran Anda sudah terkirim ke admin.')
      router.refresh()
    } catch {
      toast.error('Gagal terhubung ke server. Coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ----------------------------- Kirim ------------------------------ */}
      <section className="kartu p-6">
        <div className="flex items-start gap-4 mb-5">
          <span className="p-3 bg-amber-50 rounded-lg text-amber-500 shrink-0">
            <MessageSquare className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Kirim Saran & Masukan</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">
              Masukan Anda langsung diteruskan ke admin daycare.
            </p>
          </div>
        </div>

        <Bidang
          label="Saran dan masukan Anda"
          wajib
          hint="mis. kegiatan, jam tidur, menu makanan, atau hal lain yang perlu diperbaiki."
        >
          <textarea
            rows={4}
            className="kolom"
            value={pesan}
            onChange={(e) => setPesan(e.target.value)}
            placeholder="Tuliskan saran Anda di sini..."
          />
        </Bidang>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={kirim}
            disabled={sibuk}
            className="tombol bg-blue-700 hover:bg-blue-800 px-6 py-2.5"
          >
            {sibuk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sibuk ? 'Mengirim...' : 'Kirim Saran'}
          </button>
        </div>
      </section>

      {/* ---------------------------- Riwayat ----------------------------- */}
      <section className="kartu p-6">
        <h3 className="font-bold text-gray-800 mb-1">Saran yang Pernah Anda Kirim</h3>
        <p className="text-[12px] text-gray-500 mb-4">Total {awal.length} saran.</p>

        {awal.length === 0 ? (
          <p className="text-[13px] text-gray-500">
            Belum ada saran terkirim. Jadilah yang pertama memberi masukan!
          </p>
        ) : (
          <ul className="space-y-3">
            {awal.map((s) => (
              <li key={s.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/60">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border',
                      s.status === 'DIBACA'
                        ? 'bg-green-50 text-green-600 border-green-100'
                        : 'bg-blue-50 text-blue-600 border-blue-100',
                    )}
                  >
                    {s.status === 'DIBACA' ? 'Sudah dibaca admin' : 'Menunggu admin'}
                  </span>
                  <span className="text-[11px] text-gray-400 shrink-0" suppressHydrationWarning>
                    {formatWaktu(s.waktu)}
                  </span>
                </div>
                <p className="text-[13.5px] text-gray-700 whitespace-pre-wrap break-words">
                  {s.pesan}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
