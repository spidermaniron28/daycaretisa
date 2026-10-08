import { redirect } from 'next/navigation'
import { BookOpen, UserCog, Lightbulb } from 'lucide-react'
import { bacaSession } from '@/lib/session'
import { pengaturanAman } from '@/lib/sheets'
import { Shell, type ItemMenu } from '@/components/layout/shell'
import { roleLainDari } from '@/lib/redirect'

export const dynamic = 'force-dynamic'

const MENU: ItemMenu[] = [
  { id: 'beranda', label: 'Jurnal Harian', href: '/ortu', ikon: <BookOpen className="w-5 h-5" /> },
  { id: 'saran', label: 'Saran & Masukan', href: '/ortu/saran', ikon: <Lightbulb className="w-5 h-5" /> },
  { id: 'profil', label: 'Profil & Keamanan', href: '/ortu/profil', ikon: <UserCog className="w-5 h-5" /> },
]

export default async function OrtuLayout({ children }: { children: React.ReactNode }) {
  const session = await bacaSession()
  if (!session) redirect('/login')
  if (session.role !== 'siswa') redirect(roleLainDari(session.role))

  const pengaturan = await pengaturanAman()

  return (
    <Shell
      session={session}
      menu={MENU}
      tema="biru"
      subjudul="Orang Tua / Siswa"
      namaSekolah={pengaturan.nama_sekolah ?? ''}
      logoUrl={pengaturan.logo_url ?? ''}
      tpBerjalan={pengaturan.tp_berjalan ?? ''}
      prefix="ortu"
    >
      {children}
    </Shell>
  )
}