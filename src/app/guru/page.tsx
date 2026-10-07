import Link from 'next/link'
import { Megaphone, LifeBuoy, ArrowRight, ClipboardEdit } from 'lucide-react'
import { pengaturanAman, listLaporanGuru, listSiswa } from '@/lib/sheets'
import { bacaSession } from '@/lib/session'
import { KartuStatistik } from '@/components/ui/primitives'
import { angka } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function GuruBeranda() {
  const session = await bacaSession()
  const [pengaturan, laporan, siswa] = await Promise.all([
    pengaturanAman(),
    listLaporanGuru(session?.idAsli ?? ''),
    listSiswa(),
  ])

  const hariIni = new Date().toISOString().slice(0, 10)
  const hariIniCount = laporan.filter((l) => l.tanggal === hariIni).length
  const bulanIni = laporan.filter((l) => l.tanggal.startsWith(hariIni.slice(0, 7))).length

  return (
    <div className="space-y-6 max-w-5xl animasi-masuk">
      <div className="kartu p-6 md:p-8 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Selamat Datang, {session?.namaLengkap}!</h2>
          <p className="text-gray-500 text-[14px] leading-relaxed">
            {pengaturan.teks_motivasi || 'Terus jadi tempat tumbuh dan belajar anak-anak kita.'}
          </p>
        </div>
        <div className="absolute right-0 top-0 bottom-0 opacity-5 pointer-events-none flex items-center pr-10 hidden md:flex">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KartuStatistik
          label="Laporan Hari Ini"
          nilai={angka(hariIniCount)}
          warna="hijau"
          ikon={<ClipboardEdit className="w-6 h-6" />}
        />
        <KartuStatistik
          label="Laporan Bulan Ini"
          nilai={angka(bulanIni)}
          warna="biru"
          ikon={<Megaphone className="w-6 h-6" />}
        />
        <KartuStatistik
          label="Total Siswa Aktif"
          nilai={angka(siswa.filter((s) => (s.status || 'Aktif') === 'Aktif').length)}
          warna="ungu"
          ikon={<LifeBuoy className="w-6 h-6" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="kartu p-6 rounded-2xl border-l-4 border-l-green-500">
          <h3 className="flex items-center gap-2 mb-3 text-green-600 font-bold text-[14px]">
            <Megaphone className="w-5 h-5" />
            Pengumuman
          </h3>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            {pengaturan.teks_pengumuman_guru || 'Belum ada pengumuman dari administrator.'}
          </p>
        </div>

        <div className="kartu p-6 rounded-2xl border-l-4 border-l-blue-500">
          <h3 className="flex items-center gap-2 mb-3 text-blue-600 font-bold text-[14px]">
            <LifeBuoy className="w-5 h-5" />
            Bantuan Sistem
          </h3>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            {pengaturan.teks_bantuan || 'Jika ada kendala, hubungi administrator sekolah.'}
          </p>
        </div>
      </div>

      <Link
        href="/guru/laporan"
        className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-green-600 hover:bg-green-700 text-white transition-colors group"
      >
        <span>
          <span className="block text-[15px] font-bold">Input Laporan Harian</span>
          <span className="block text-[12px] text-green-50 opacity-90">
            Catat kehadiran, makan, tidur, dan kesehatan anak.
          </span>
        </span>
        <ArrowRight className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  )
}