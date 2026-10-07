import { redirect } from 'next/navigation'
import { bacaSession } from '@/lib/session'
import { listPengaturan } from '@/lib/sheets'
import { LoginForm } from '@/components/auth/login-form'
import type { Pengaturan } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function HalamanLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await bacaSession()
  if (session) {
    redirect(session.role === 'admin' ? '/admin' : session.role === 'guru' ? '/guru' : '/ortu')
  }

  const { next } = await searchParams

  // Pengaturan diambil dengan aman: kalau kredensial Google belum siap,
  // halaman login tetap tampil (dengan nilai bawaan) daripada error total.
  let pengaturan: Pengaturan = {}
  try {
    pengaturan = await listPengaturan()
  } catch (e) {
    // Kredensial Google belum siap itu kondisi yang memang ditangani (halaman
    // tetap tampil dengan nilai bawaan) — pakai warn supaya tidak dihitung
    // sebagai issue oleh dev overlay Next.js.
    console.warn('[login] gagal memuat pengaturan:', (e as Error).message)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={
        pengaturan.bg_luar_url
          ? {
              backgroundImage: `url('${pengaturan.bg_luar_url}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <div className="fixed inset-0 bg-black/40 -z-10" />

      <div className="relative z-10 w-full max-w-4xl bg-white shadow-2xl overflow-hidden rounded-2xl flex flex-col md:flex-row min-h-[520px]">
        {/* ----------------------------- KIRI ----------------------------- */}
        <div
          className="w-full md:w-1/2 text-white flex flex-col items-center justify-center p-10 relative bg-biru-kolom"
          style={
            pengaturan.bg_kiri_url
              ? {
                  backgroundImage: `linear-gradient(rgba(23,54,97,0.82), rgba(23,54,97,0.92)), url('${pengaturan.bg_kiri_url}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          <div className="mb-4 w-20 h-20 flex items-center justify-center">
            <img
              src={pengaturan.logo_url || '/logo.png'}
              alt="Logo sekolah"
              className="w-20 h-20 object-contain drop-shadow-md"
            />
          </div>

          <h2 className="text-[17px] font-semibold tracking-wider text-center mt-2 text-white">
            {pengaturan.nama_sekolah || 'E-RAPOR DAYCARE'}
          </h2>
          <h1 className="text-[44px] font-bold text-kuning mt-0 mb-1 tracking-widest drop-shadow-sm">
            E-RAPOR
          </h1>
          <p className="text-[13px] font-light mb-10 text-center text-gray-200">
            Sistem Informasi Harian &amp; Perkembangan Anak
          </p>

          {pengaturan.teks_pengumuman && (
            <div className="border border-white/20 bg-black/25 backdrop-blur-sm px-8 py-2.5 rounded-lg text-sm text-center font-medium shadow-inner">
              {pengaturan.teks_pengumuman}
            </div>
          )}

          <div className="absolute bottom-5 text-[11px] text-gray-300">
            © {new Date().getFullYear()} Sistem Informasi Daycare.
          </div>
        </div>

        {/* ---------------------------- KANAN ----------------------------- */}
        <div className="w-full md:w-1/2 bg-[#fdfdfd] flex flex-col justify-center px-8 md:px-12 py-10">
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  )}
