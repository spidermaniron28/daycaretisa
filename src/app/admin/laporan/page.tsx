import { listSiswa, listRombel, pengaturanAman, listLaporanSiswa, listGuru } from '@/lib/sheets'
import { RekapLaporan } from '@/components/laporan/rekap'
import type { InfoGuru } from '@/components/laporan/detail-laporan'

export const dynamic = 'force-dynamic'

export default async function AdminLaporan() {
  const [siswa, rombel, pengaturan, guru] = await Promise.all([
    listSiswa(),
    listRombel(),
    pengaturanAman(),
    listGuru(),
  ])

  const laporan = await Promise.all(
    siswa.map(async (s) => ({ siswa: s, laporan: await listLaporanSiswa(s.nis) })),
  )

  // Peta NIP → info guru, dipakai atribusi "Diinput oleh" di modal Lihat.
  const petaGuru = new Map(guru.map((g) => [g.nip, { nama: g.nama, foto: g.foto }]))
  const guruPerLaporan: Record<string, InfoGuru | undefined> = {}
  for (const { laporan: daftar } of laporan) {
    for (const l of daftar) {
      if (!l.guruNip) continue
      const g = petaGuru.get(l.guruNip)
      if (g) guruPerLaporan[l.id] = g
    }
  }

  return (
    <RekapLaporan
      laporan={laporan}
      rombel={rombel}
      namaSekolah={pengaturan.nama_sekolah ?? 'E-Rapor Daycare'}
      guruPerLaporan={guruPerLaporan}
    />
  )
}
