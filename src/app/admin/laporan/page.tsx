import { listSiswa, listRombel, pengaturanAman, listLaporanSiswa } from '@/lib/sheets'
import { RekapLaporan } from '@/components/laporan/rekap'

export const dynamic = 'force-dynamic'

export default async function AdminLaporan() {
  const [siswa, rombel, pengaturan] = await Promise.all([
    listSiswa(),
    listRombel(),
    pengaturanAman(),
  ])

  const laporan = await Promise.all(
    siswa.map(async (s) => ({ siswa: s, laporan: await listLaporanSiswa(s.nis) })),
  )

  return (
    <RekapLaporan
      laporan={laporan}
      rombel={rombel}
      namaSekolah={pengaturan.nama_sekolah ?? 'E-Rapor Daycare'}
    />
  )
}