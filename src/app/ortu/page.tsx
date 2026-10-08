import { listLaporanSiswa, siswaByNis, guruByNip } from '@/lib/sheets'
import { bacaSession } from '@/lib/session'
import { JurnalAnak } from '@/components/laporan/jurnal'
import type { InfoGuru } from '@/components/laporan/detail-laporan'

export const dynamic = 'force-dynamic'

export default async function OrtuBeranda() {
  const session = await bacaSession()
  const nis = session?.idAsli ?? ''

  const [laporan, siswa] = await Promise.all([listLaporanSiswa(nis), siswaByNis(nis)])

  // Siapa yang menginput tiap laporan — supaya orang tua tahu guru mana yang
  // mengisi catatan itu (dengan foto profilnya). Laporan tanpa guru (lama /
  // guru sudah dihapus) hanya tidak menampilkan atribusi, bukan error.
  const guruPerLaporan: Record<string, InfoGuru | undefined> = {}
  await Promise.all(
    laporan.map(async (l) => {
      if (!l.guruNip) return
      const g = await guruByNip(l.guruNip)
      if (g) guruPerLaporan[l.id] = { nama: g.nama, foto: g.foto }
    }),
  )

  return (
    <JurnalAnak
      laporan={laporan}
      namaAnak={siswa?.nama ?? session?.namaLengkap ?? 'Anak'}
      nis={nis}
      guruPerLaporan={guruPerLaporan}
    />
  )
}
