import Link from 'next/link'
import { Users, GraduationCap, Boxes, UserPlus, ArrowRight, Megaphone, Lightbulb, UserCog } from 'lucide-react'
import { statistik, pengaturanAman } from '@/lib/sheets'
import { KartuStatistik } from '@/components/ui/primitives'
import { angka } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminBeranda() {
  const [stat, pengaturan] = await Promise.all([statistik(), pengaturanAman()])

  return (
    <div className="space-y-6 animasi-masuk max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KartuStatistik
          label="Total Siswa Aktif"
          nilai={angka(stat.siswaAktif)}
          warna="biru"
          ikon={<Users className="w-6 h-6" />}
        />
        <KartuStatistik
          label="Total Guru"
          nilai={angka(stat.guru)}
          warna="hijau"
          ikon={<GraduationCap className="w-6 h-6" />}
        />
        <KartuStatistik
          label="Total Rombel"
          nilai={angka(stat.rombel)}
          warna="ungu"
          ikon={<Boxes className="w-6 h-6" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="kartu p-6 md:p-8 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-green-600 font-bold text-[14px] mb-3">
              <Megaphone className="w-5 h-5" />
              Pengumuman Sekolah
            </div>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              {pengaturan.teks_pengumuman || 'Belum ada pengumuman. Atur di menu Sistem & Akses.'}
            </p>
          </div>
        </div>

        <div className="kartu p-6 md:p-8">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-[14px] mb-3">
            <Lightbulb className="w-5 h-5" />
            Tahun Pelajaran Berjalan
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {pengaturan.tp_berjalan || 'Belum ditentukan'}
          </p>
          <p className="text-[13px] text-gray-500 mt-1">
            {pengaturan.nama_sekolah || 'E-Rapor Daycare'}
          </p>
        </div>
      </div>

      <div className="kartu p-6 md:p-8">
        <h2 className="text-[15px] font-bold text-gray-800 mb-1">Aksi Cepat</h2>
        <p className="text-[13px] text-gray-500 mb-5">Pintasan ke menu yang paling sering dipakai.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AksiCepat href="/admin/siswa" judul="Tambah Siswa" ikon={<UserPlus className="w-5 h-5" />} />
          <AksiCepat href="/admin/laporan" judul="Rekap Laporan" ikon={<Boxes className="w-5 h-5" />} />
          <AksiCepat href="/admin/akun" judul="Kelola Akun" ikon={<UserCog className="w-5 h-5" />} />
        </div>
      </div>
    </div>
  )
}

function AksiCepat({
  href,
  judul,
  ikon,
}: {
  href: string
  judul: string
  ikon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all group"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          {ikon}
        </span>
        <span className="text-[13px] font-semibold text-gray-700 truncate">{judul}</span>
      </span>
      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0" />
    </Link>
  )
}