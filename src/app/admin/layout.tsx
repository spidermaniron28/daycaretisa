import { redirect } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Boxes,
  UserCog,
  Settings,
  FileSpreadsheet,
  MessageSquare,
} from 'lucide-react'
import { bacaSession } from '@/lib/session'
import { pengaturanAman, jumlahSaranBaru } from '@/lib/sheets'
import { Shell, type ItemMenu } from '@/components/layout/shell'
import { roleLainDari } from '@/lib/redirect'

export const dynamic = 'force-dynamic'

const MENU: ItemMenu[] = [
  { id: 'ringkasan', label: 'Ringkasan', href: '/admin', ikon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'laporan', label: 'Rekap Laporan', href: '/admin/laporan', ikon: <FileSpreadsheet className="w-5 h-5" /> },
  { id: 'saran', label: 'Saran & Masukan', href: '/admin/saran', ikon: <MessageSquare className="w-5 h-5" /> },
  { id: 'siswa', label: 'Data Siswa', href: '/admin/siswa', ikon: <Users className="w-5 h-5" /> },
  { id: 'guru', label: 'Data Guru', href: '/admin/guru', ikon: <GraduationCap className="w-5 h-5" /> },
  { id: 'rombel', label: 'Rombel / Kelas', href: '/admin/rombel', ikon: <Boxes className="w-5 h-5" /> },
  { id: 'akun', label: 'Akun Pengguna', href: '/admin/akun', ikon: <UserCog className="w-5 h-5" /> },
  { id: 'sistem', label: 'Sistem & Akses', href: '/admin/sistem', ikon: <Settings className="w-5 h-5" /> },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await bacaSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') redirect(roleLainDari(session.role))

  const [pengaturan, saranBaru] = await Promise.all([pengaturanAman(), jumlahSaranBaru()])

  // Lencana merah = notifikasi saran yang belum dibaca admin.
  const menu = MENU.map((m) => (m.id === 'saran' ? { ...m, lencana: saranBaru } : m))

  return (
    <Shell
      session={session}
      menu={menu}
      tema="navy"
      subjudul="Administrator"
      namaSekolah={pengaturan.nama_sekolah || 'PORTAL E-RAPOR'}
      logoUrl={pengaturan.logo_url || ''}
      tpBerjalan={pengaturan.tp_berjalan || ''}
      prefix="admin"
    >
      {children}
    </Shell>
  )
}