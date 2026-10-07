'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ShieldCheck, GraduationCap, Users, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/types'

const OPSI: Array<{ role: Role; label: string; ikon: typeof ShieldCheck }> = [
  { role: 'admin', label: 'Administrator', ikon: ShieldCheck },
  { role: 'guru', label: 'Guru', ikon: GraduationCap },
  { role: 'siswa', label: 'Orang Tua/Siswa', ikon: Users },
]

/** Folder yang boleh dituju tiap role — dipakai untuk memvalidasi redirect. */
function folderUntuk(role: Role): string {
  return role === 'admin' ? '/admin' : role === 'guru' ? '/guru' : '/ortu'
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [role, setRole] = useState<Role>('admin')
  const [dropdownBuka, setDropdownBuka] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [lihatSandi, setLihatSandi] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  const terpilih = OPSI.find((o) => o.role === role)!
  const Ikon = terpilih.ikon

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error('Mohon isi username dan kata sandi.')
      return
    }

    setSibuk(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, username, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Gagal login.')
        setSibuk(false)
        return
      }

      // `next` hanya dipakai kalau tujuan masih di portal yang sama,
      // supaya orang tua tidak bisa dialihkan ke halaman admin lewat URL.
      const tujuanAman =
        next && next.startsWith('/') && next.startsWith(folderUntuk(role)) ? next : data.redirect

      toast.success('Login berhasil. Selamat datang!')
      router.replace(tujuanAman)
      router.refresh()
    } catch {
      toast.error('Terjadi kesalahan jaringan. Periksa koneksi Anda.')
      setSibuk(false)
    }
  }

  return (
    <>
      <div className="text-center mb-10">
        <h2 className="text-lg font-bold text-biru-kolom tracking-wider">LOGIN PORTAL</h2>
      </div>

      <form onSubmit={submit} className="space-y-8 w-full max-w-sm mx-auto">
        {/* ------------------------- Pilih peran ------------------------- */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownBuka((v) => !v)}
            aria-expanded={dropdownBuka}
            aria-haspopup="listbox"
            className="w-full bg-transparent text-gray-700 outline-none text-[15px] pb-2 border-b border-gray-300 flex justify-between items-center cursor-pointer group"
          >
            <span className="flex items-center gap-2.5">
              <Ikon className="w-4.5 h-4.5 text-blue-500" />
              {terpilih.label}
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-gray-400 transition-transform duration-300',
                dropdownBuka && 'rotate-180',
              )}
            />
          </button>

          {dropdownBuka && (
            <>
              <button
                type="button"
                aria-label="Tutup"
                className="fixed inset-0 z-40"
                onClick={() => setDropdownBuka(false)}
              />
              <div
                role="listbox"
                className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-lg shadow-lg overflow-hidden animasi-masuk"
              >
                <div className="p-2 space-y-1">
                  {OPSI.map((o) => {
                    const I = o.ikon
                    return (
                      <button
                        key={o.role}
                        type="button"
                        role="option"
                        aria-selected={o.role === role}
                        onClick={() => {
                          setRole(o.role)
                          setDropdownBuka(false)
                        }}
                        className={cn(
                          'w-full cursor-pointer flex items-center gap-3 px-4 py-2.5 text-sm rounded-md transition-colors',
                          o.role === role
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                        )}
                      >
                        <I className="w-5 h-5 text-gray-400" />
                        <span className="font-medium">{o.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ------------------------ Username ----------------------------- */}
        <div className="relative border-b border-gray-300 py-2">
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder=" "
            required
            className="peer w-full bg-transparent text-gray-700 outline-none text-[15px] pb-1"
          />
          <label
            htmlFor="username"
            className="absolute left-0 top-2 text-gray-400 text-[15px] pointer-events-none transition-all duration-300 peer-focus:-top-4 peer-focus:text-xs peer-focus:text-biru-kolom peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs"
          >
            {/* Kolom akun juga menerima NIS/NIP (kolom "ID Asli"), jadi labelnya
                menyesuaikan peran supaya orang tua tahu apa yang boleh diisi. */}
            Username{role === 'guru' ? ' / NIP' : role === 'siswa' ? ' / NIS' : ''}
          </label>
        </div>

        {/* ------------------------- Sandi ------------------------------- */}
        <div className="relative border-b border-gray-300 py-2">
          <input
            id="password"
            type={lihatSandi ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder=" "
            required
            className="peer w-full bg-transparent text-gray-700 outline-none text-[15px] pb-1 pr-8"
          />
          <label
            htmlFor="password"
            className="absolute left-0 top-2 text-gray-400 text-[15px] pointer-events-none transition-all duration-300 peer-focus:-top-4 peer-focus:text-xs peer-focus:text-biru-kolom peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs"
          >
            Kata Sandi
          </label>
          <button
            type="button"
            onClick={() => setLihatSandi((v) => !v)}
            aria-label={lihatSandi ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            className="absolute right-0 top-1.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {lihatSandi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={sibuk}
            className="group relative w-full flex justify-center py-2.5 px-4 text-sm font-semibold rounded-md text-white bg-lokal hover:bg-lokal-gelap focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lokal transition-all shadow-md disabled:opacity-70"
          >
            <span className="absolute right-0 inset-y-0 flex items-center pr-3">
              <ArrowRight className="h-5 w-5 text-kuning group-hover:translate-x-1 transition-transform duration-300" />
            </span>
            {sibuk ? 'MEMPROSES...' : 'LOGIN'}
          </button>
        </div>
      </form>
    </>
  )
}