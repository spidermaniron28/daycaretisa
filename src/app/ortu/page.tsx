import { listLaporanSiswa, siswaByNis } from '@/lib/sheets'
import { bacaSession } from '@/lib/session'
import { JurnalAnak } from '@/components/laporan/jurnal'

export const dynamic = 'force-dynamic'

export default async function OrtuBeranda() {
  const session = await bacaSession()
  const nis = session?.idAsli ?? ''

  const [laporan, siswa] = await Promise.all([listLaporanSiswa(nis), siswaByNis(nis)])

  return (
    <JurnalAnak
      laporan={laporan}
      namaAnak={siswa?.nama ?? session?.namaLengkap ?? 'Anak'}
      nis={nis}
    />
  )
}