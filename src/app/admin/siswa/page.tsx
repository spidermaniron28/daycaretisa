import { listSiswa, listRombel } from '@/lib/sheets'
import { TabelSiswa } from '@/components/siswa/tabel-siswa'

export const dynamic = 'force-dynamic'

export default async function HalamanSiswa() {
  const [siswa, rombel] = await Promise.all([listSiswa(), listRombel()])
  return <TabelSiswa awal={siswa} rombel={rombel} />
}