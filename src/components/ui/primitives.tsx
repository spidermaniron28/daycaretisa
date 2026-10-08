'use client'

import type { ReactNode } from 'react'
import { Loader2, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ---------------------------------------------------------------------------
 * Potongan UI kecil yang dipakai berulang di banyak halaman.
 * ------------------------------------------------------------------------- */

export function Memuat({ pesan = 'Memuat data...' }: { pesan?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      <span className="text-[13px]">{pesan}</span>
    </div>
  )
}

export function Kosong({
  judul = 'Belum ada data',
  pesan,
  ikon = true,
}: {
  judul?: string
  pesan?: string
  ikon?: boolean
}) {
  return (
    <div className="kartu-kosong">
      {ikon && <Inbox className="w-9 h-9 text-gray-300" />}
      <p className="font-medium text-gray-500">{judul}</p>
      {pesan && <p className="max-w-sm text-gray-400">{pesan}</p>}
    </div>
  )
}

export function Bidang({
  label,
  wajib,
  hint,
  className = '',
  children,
}: {
  label: string
  wajib?: boolean
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <label className="kolom-label">
        {label}
        {wajib && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

/**
 * Kartu statistik angka besar — dipakai di beranda tiap portal.
 *
 * Di layar kecil kartu tampil berlatar penuh berwarna (gradient) dengan teks
 * putih dan kotak ikon translusen supaya ringkasan lebih hidup dan enak
 * dipandang; sejak sm kembali ke kartu putih dengan kotak ikon berwarna
 * seperti semula.
 */
export function KartuStatistik({
  label,
  nilai,
  warna,
  ikon,
  className = '',
}: {
  label: string
  nilai: string | number
  warna: 'biru' | 'hijau' | 'ungu' | 'amber'
  ikon: ReactNode
  className?: string
}) {
  // Latar penuh khusus mobile; sm:bg-none menghapus gradient sehingga kartu
  // kembali putih (bg-white bawaan class `kartu`) di layar lebar.
  const latar = {
    biru: 'bg-gradient-to-br from-blue-500 to-blue-600 sm:bg-none',
    hijau: 'bg-gradient-to-br from-green-500 to-emerald-600 sm:bg-none',
    ungu: 'bg-gradient-to-br from-violet-500 to-purple-600 sm:bg-none',
    amber: 'bg-gradient-to-br from-amber-400 to-orange-500 sm:bg-none',
  }[warna]

  const kotakIkon = {
    biru: 'bg-white/25 text-white sm:bg-blue-50 sm:text-blue-500',
    hijau: 'bg-white/25 text-white sm:bg-green-50 sm:text-green-500',
    ungu: 'bg-white/25 text-white sm:bg-violet-50 sm:text-violet-500',
    amber: 'bg-white/25 text-white sm:bg-amber-50 sm:text-amber-500',
  }[warna]

  return (
    <div
      className={cn(
        'kartu p-4 sm:p-6 flex flex-col items-start gap-2.5',
        'sm:flex-row sm:items-center sm:gap-5',
        latar,
        className,
      )}
    >
      <div
        className={cn(
          'w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-full',
          'flex items-center justify-center shrink-0',
          kotakIkon,
        )}
      >
        {ikon}
      </div>
      <div className="min-w-0 w-full">
        <p className="text-[12px] sm:text-[13px] text-white/85 font-medium mb-0.5 truncate sm:text-gray-500">
          {label}
        </p>
        <h3 className="text-xl sm:text-2xl font-bold text-white sm:text-gray-800">{nilai}</h3>
      </div>
    </div>
  )
}