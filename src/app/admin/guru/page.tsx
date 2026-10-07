import { listGuru, listRombel } from '@/lib/sheets'
import { TabelGuru } from '@/components/guru/tabel-guru'

export const dynamic = 'force-dynamic'

export default async function HalamanGuru() {
  const [guru, rombel] = await Promise.all([listGuru(), listRombel()])
  return <TabelGuru awal={guru} rombel={rombel} />
}