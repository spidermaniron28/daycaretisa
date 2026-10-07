import { redirect } from 'next/navigation'
import { Home, Users, ClipboardEdit, History, UserCog } from 'lucide-react'
import { bacaSession } from '@/lib/session'
import { pengaturanAman } from '@/lib/sheets'
import { Shell, type ItemMenu } from '@/components/layout/shell'
import { roleLainDari } from '@/lib/redirect'

export const dynamic = 'force-dynamic'

const MENU: ItemMenu[] = [
  { id: 'beranda', label: 'Beranda Guru', href: '/guru', ikon: <Home className="w-5 h-5" /> },
  { id: 'siswa', label: 'Data Siswa', href: '/guru/siswa', ikon: <Users className="w-5 h-5" /> },
  { id: 'laporan', label: 'Input Laporan', href: '/guru/laporan', ikon: <ClipboardEdit className="w-5 h-5" /> },
  { id: 'riwayat', label: 'Riwayat Laporan', href: '/guru/riwayat', ikon: <History className="w-5 h-5" /> },
  { id: 'profil', label: 'Profil Saya', href: '/guru/profil', ikon: <UserCog className="w-5 h-5" /> },
]

export default async function GuruLayout({ children }: { children: React.ReactNode }) {
  const session = await bacaSession()
  if (!session) redirect('/login')
  if (session.role !== 'guru') redirect(roleLainDari(session.role))

  const pengaturan = await pengaturanAman()

  return (
    <Shell
      session={session}
      menu={MENU}
      tema="hijau"
      subjudul="Guru Pengajar"
      namaSekolah={pengaturan.nama_sekolah ?? ''}
      logoUrl={pengaturan.logo_url ?? ''}
      tpBerjalan={pengaturan.tp_berjalan ?? ''}
      prefix="guru"
    >
      {children}
    </Shell>
  )
}