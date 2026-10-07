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

/** Kartu statistik angka besar — dipakai di beranda tiap portal. */
export function KartuStatistik({
  label,
  nilai,
  warna,
  ikon,
}: {
  label: string
  nilai: string | number
  warna: 'biru' | 'hijau' | 'ungu' | 'amber'
  ikon: ReactNode
}) {
  const gaya = {
    biru: 'bg-blue-50 text-blue-500',
    hijau: 'bg-green-50 text-green-500',
    ungu: 'bg-violet-50 text-violet-500',
    amber: 'bg-amber-50 text-amber-500',
  }[warna]

  return (
    <div className="kartu p-6 flex items-center gap-5">
      <div className={cn('w-12 h-12 rounded-full flex items-center justify-center shrink-0', gaya)}>
        {ikon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-gray-500 font-medium mb-0.5 truncate">{label}</p>
        <h3 className="text-2xl font-bold text-gray-800">{nilai}</h3>
      </div>
    </div>
  )
}