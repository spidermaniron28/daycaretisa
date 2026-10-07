'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  deskripsi?: string
  children: ReactNode
  footer?: ReactNode
  lebar?: 'sm' | 'md' | 'lg'
}

const LEBAR = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
}

export function Modal({
  open,
  onClose,
  title,
  deskripsi,
  children,
  footer,
  lebar = 'md',
}: Props) {
  // Tutup dengan tombol Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Cegah halaman di belakang ikut ter-scroll.
    const overflowAwal = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowAwal
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full bg-white shadow-2xl animasi-masuk',
          'rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col',
          LEBAR[lebar],
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-[16px] font-bold text-gray-800">{title}</h2>
            {deskripsi && <p className="text-[13px] text-gray-500 mt-0.5">{deskripsi}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-6 py-5 overflow-y-auto grow">{children}</div>

        {footer && (
          <footer className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0 bg-gray-50/50 rounded-b-2xl">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

interface KonfirmasiProps {
  open: boolean
  onClose: () => void
  onKonfirmasi: () => void
  judul: string
  pesan: string
  labelKonfirmasi?: string
  bahaya?: boolean
  sibuk?: boolean
}

export function Konfirmasi({
  open,
  onClose,
  onKonfirmasi,
  judul,
  pesan,
  labelKonfirmasi = 'Ya, Lanjutkan',
  bahaya = true,
  sibuk = false,
}: KonfirmasiProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={judul}
      lebar="sm"
      footer={
        <>
          <button type="button" className="tombol-garis" onClick={onClose} disabled={sibuk}>
            Batal
          </button>
          <button
            type="button"
            onClick={onKonfirmasi}
            disabled={sibuk}
            className={bahaya ? 'tombol bg-red-600 text-white hover:bg-red-700' : 'tombol-biru'}
          >
            {sibuk ? 'Memproses...' : labelKonfirmasi}
          </button>
        </>
      }
    >
      <p className="text-[14px] text-gray-600 leading-relaxed">{pesan}</p>
    </Modal>
  )
}