import { listLaporanGuru, listSiswa } from '@/lib/sheets'
import { bacaSession } from '@/lib/session'
import { TabelRiwayat } from '@/components/laporan/tabel-riwayat'

export const dynamic = 'force-dynamic'

export default async function GuruRiwayat() {
  const session = await bacaSession()
  const [laporan, siswa] = await Promise.all([
    listLaporanGuru(session?.idAsli ?? ''),
    listSiswa(),
  ])
  return <TabelRiwayat laporan={laporan} siswa={siswa} />
}