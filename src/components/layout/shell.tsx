'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, LogOut, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageTitle } from './page-title'
import type { SessionPayload } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Kerangka tiga portal (admin / guru / ortu).
 *
 * SidebarNYA pada layar kecil menjadi overlay yang bisa dibuka-tutup,
 * menggantikan widget simulator perangkat di aplikasi Apps Script lama.
 * ------------------------------------------------------------------------- */

export interface ItemMenu {
  id: string
  label: string
  href: string
  ikon: ReactNode
}

interface Props {
  session: SessionPayload
  menu: ItemMenu[]
  /** Warna sidebar mengikuti identitas tiap portal. */
  tema: 'navy' | 'hijau' | 'biru'
  /** Label kecil di bawah nama portal. */
  subjudul: string
  /** URL logo; bila kosong pakai ikon matahari bawaan. */
  logoUrl?: string
  namaSekolah: string
  tpBerjalan: string
  /** Slot tambahan di atas blok user di sidebar. */
  tambahanSidebar?: ReactNode
  /** Menentukan judul topbar lewat peta path (lihat ./page-title). */
  prefix: 'admin' | 'guru' | 'ortu'
  /** Isi halaman. */
  children: ReactNode
}

const TEMA = {
  navy: {
    aside: 'bg-navy',
    aktif: 'bg-navy-sidebar',
    border: 'border-gray-800',
    sub: 'text-gray-400',
    badge: 'lencana-biru',
  },
  hijau: {
    aside: 'bg-hijau',
    aktif: 'bg-[#132b3d]',
    border: 'border-hijau-border',
    sub: 'text-green-400',
    badge: 'lencana-hijau',
  },
  biru: {
    aside: 'bg-[#16233d]',
    aktif: 'bg-[#1e293b]',
    border: 'border-[#243350]',
    sub: 'text-blue-300',
    badge: 'lencana-biru',
  },
} as const

export function Shell({
  session,
  menu,
  tema,
  subjudul,
  logoUrl = '',
  namaSekolah,
  tpBerjalan,
  tambahanSidebar,
  prefix,
  children,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarBuka, setSidebarBuka] = useState(false)
  const [menuAkunBuka, setMenuAkunBuka] = useState(false)
  const [keluar, setKeluar] = useState(false)

  const t = TEMA[tema]
  const inisial = session.namaLengkap.trim().charAt(0).toUpperCase() || '?'

  async function prosesKeluar() {
    setKeluar(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      toast.success('Anda telah keluar.')
      router.replace('/login')
      router.refresh()
    } catch {
      toast.error('Gagal keluar. Silakan coba lagi.')
    } finally {
      setKeluar(false)
    }
  }

  /*
    Menu aktif = kandidat dengan href TERPANJANG yang cocok.

    Pencocokan awalan biasa membuat dua menu ikut menyala sekaligus: di
    /admin/laporan, Ringkasan (/admin) juga cocok karena "/admin/laporan"
    diawali "/admin/". Memilih yang paling spesifik memastikan hanya
    "Rekap Laporan" yang menyala, dan tetap benar untuk portal guru/ortu
    yang polanya sama (Beranda Guru /guru vs Input Laporan /guru/laporan).
  */
  const hrefAktif = useMemo(() => {
    const kandidat = menu.filter(
      (m) => pathname === m.href || pathname.startsWith(`${m.href}/`),
    )
    return kandidat.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? ''
  }, [menu, pathname])

  const aktif = (href: string) => href === hrefAktif

  return (
    <div className="min-h-screen flex bg-gray-50">
      {sidebarBuka && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setSidebarBuka(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      {/* ---------------------------- SIDEBAR ---------------------------- */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 h-screen w-[250px] shrink-0',
          'text-white flex flex-col shadow-2xl lg:shadow-none',
          'transition-transform duration-300',
          t.aside,
          sidebarBuka ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className={cn('flex items-center gap-3 px-5 py-5 border-b shrink-0', t.border)}>
          <div className="w-8 h-8 shrink-0 flex items-center justify-center">
            <img
              src={logoUrl || '/logo.png'}
              alt="Logo sekolah"
              className="w-8 h-8 object-contain"
            />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-[11px] uppercase tracking-wider truncate text-white">
              {tema === 'navy' ? namaSekolah : 'E-RAPOR DAYCARE'}
            </h2>
            <p className={cn('text-[10px] -mt-0.5 truncate', t.sub)}>{subjudul}</p>
          </div>
        </div>

        <nav className="flex-1 py-5 flex flex-col gap-1 px-3 overflow-y-auto">
          {/*
            prefetch: unduh payload tiap halaman menu di latar belakang sejak
            link terlihat, supaya saat diklik isinya langsung tampil tanpa
            menunggu render server (halaman portal semuanya force-dynamic).
          */}
          {menu.map((m) => (
            <Link
              key={m.id}
              href={m.href}
              prefetch
              onClick={() => setSidebarBuka(false)}
              aria-current={aktif(m.href) ? 'page' : undefined}
              className={cn('nav-item', aktif(m.href) && 'nav-item-aktif')}
            >
              <span className={cn('shrink-0', aktif(m.href) && 'text-blue-400')}>{m.ikon}</span>
              <span className="truncate">{m.label}</span>
            </Link>
          ))}
        </nav>

        <div className={cn('px-5 py-4 border-t shrink-0', t.border)}>
          {tambahanSidebar}

          <div className="flex items-center gap-3">
            {session.foto ? (
              <img
                src={session.foto}
                alt={session.namaLengkap}
                className="w-9 h-9 rounded-full border border-white/20 object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/10 text-white font-bold text-xs flex items-center justify-center border border-white/20 shrink-0">
                {inisial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold truncate">{session.namaLengkap}</p>
              <p className={cn('text-[11px] truncate', t.sub)}>{subjudul}</p>
            </div>
            {/*
              Ikon keluar bersebelahan langsung dengan nama+profil. Hanya ikon
              (tanpa teks "Keluar") supaya tetap muat di sidebar 250px dan
              tidak pernah terpotong di layar kecil.
            */}
            <button
              type="button"
              onClick={prosesKeluar}
              disabled={keluar}
              aria-label="Keluar"
              title="Keluar"
              className="shrink-0 p-2 -mr-1 text-red-400 hover:text-red-300 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---------------------------- KONTEN ----------------------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white px-4 md:px-8 py-4 flex justify-between items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarBuka((v) => !v)}
              aria-label={sidebarBuka ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={sidebarBuka}
              className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <PageTitle prefix={prefix} />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {tpBerjalan && (
              <span className={cn('hidden sm:inline-flex', t.badge)}>
                <Calendar className="w-4 h-4" />
                <span>{tpBerjalan}</span>
              </span>
            )}

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuAkunBuka((v) => !v)}
                  aria-expanded={menuAkunBuka}
                  aria-label="Menu akun"
                  className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center hover:bg-gray-200 transition-colors overflow-hidden"
                >
                  {/* Sama seperti sidebar: pakai foto profil bila ada, kalau belum
                      tampilkan inisial nama. */}
                  {session.foto ? (
                    <img src={session.foto} alt={session.namaLengkap} className="w-full h-full object-cover" />
                  ) : (
                    inisial
                  )}
                </button>

                {menuAkunBuka && (
                  <>
                    <button
                      type="button"
                      aria-label="Tutup menu"
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuAkunBuka(false)}
                    />
                    <div className="absolute right-0 top-11 z-50 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animasi-masuk">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-[13px] font-semibold text-gray-800 truncate">
                          {session.namaLengkap}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {session.role === 'siswa' ? 'NIS' : session.role === 'guru' ? 'NIP' : 'Peran'}:{' '}
                          {session.idAsli}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={prosesKeluar}
                        disabled={keluar}
                        className="flex items-center gap-2 px-4 py-3 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Keluar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
      </div>
    </div>
  )
}

