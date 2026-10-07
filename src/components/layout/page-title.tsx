'use client'

import { usePathname } from 'next/navigation'

/* ---------------------------------------------------------------------------
 * Judul halaman pada topbar.
 *
 * Dipetakan dari path agar layout (yang merender Shell) dan halaman (yang
 * merender isi) tidak perlu saling mengoper data judul. Satu sumber kebenaran.
 * ------------------------------------------------------------------------- */

const DAFTAR: Array<{ path: string; judul: string; sub: string }> = [
  // Admin
  { path: '/admin/laporan', judul: 'Rekap & Ekspor Laporan', sub: 'Ringkasan laporan harian anak per periode.' },
  { path: '/admin/siswa', judul: 'Kelola Data Siswa', sub: 'Tambah, ubah, dan hapus data anak daycare.' },
  { path: '/admin/guru', judul: 'Kelola Data Guru', sub: 'Data pengajar dan kelas yang diampu.' },
  { path: '/admin/rombel', judul: 'Kelola Rombel / Kelas', sub: 'Kelas yang muncul sebagai pilihan pada data siswa.' },
  { path: '/admin/akun', judul: 'Manajemen Akun Pengguna', sub: 'Akun portal untuk administrator, guru, dan orang tua.' },
  { path: '/admin/sistem', judul: 'Pengaturan Sistem', sub: 'Identitas sekolah, gambar, dan teks beranda tiap portal.' },
  { path: '/admin', judul: 'Beranda Administrator', sub: 'Selamat datang kembali! Kelola data rapor hari ini.' },

  // Guru
  { path: '/guru/laporan', judul: 'Input Laporan Harian Anak', sub: 'Isi kehadiran, makan, tidur, kesehatan, dan catatan pengasuh.' },
  { path: '/guru/riwayat', judul: 'Riwayat Laporan', sub: 'Laporan yang pernah Anda input sebelumnya.' },
  { path: '/guru/siswa', judul: 'Data Siswa', sub: 'Daftar anak yang menjadi tanggung jawab Anda.' },
  { path: '/guru/profil', judul: 'Pengaturan Profil', sub: 'Perbarui data diri dan foto profil Anda.' },
  { path: '/guru', judul: 'Beranda Guru', sub: 'Selamat datang di portal pengasuhan harian.' },

  // Orang tua
  { path: '/ortu/profil', judul: 'Profil & Keamanan', sub: 'Data anak, foto profil, dan kata sandi akun Anda.' },
  { path: '/ortu', judul: 'Jurnal Harian Anak', sub: 'Rekam aktivitas harian anak di sekolah.' },
]

const CADANGAN: Record<string, { judul: string; sub: string }> = {
  admin: { judul: 'Beranda Administrator', sub: 'Kelola data rapor hari ini.' },
  guru: { judul: 'Beranda Guru', sub: 'Portal pengasuhan harian.' },
  siswa: { judul: 'Jurnal Harian Anak', sub: 'Rekam aktivitas harian anak di sekolah.' },
}

export function PageTitle({ prefix }: { prefix: 'admin' | 'guru' | 'ortu' }) {
  const pathname = usePathname()

  const cocok = DAFTAR.find(
    (d) => pathname === d.path || (d.path.split('/').length > 2 && pathname.startsWith(`${d.path}/`)),
  )

  const { judul, sub } = cocok ?? CADANGAN[prefix]

  return (
    <>
      <h1 className="text-lg md:text-xl font-bold text-gray-800 truncate">{judul}</h1>
      <p className="text-[11px] md:text-[13px] text-gray-500 mt-0.5 truncate hidden sm:block">{sub}</p>
    </>
  )
}