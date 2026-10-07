import { listRombel } from '@/lib/sheets'
import { TabelRombel } from '@/components/rombel/tabel-rombel'

export const dynamic = 'force-dynamic'

export default async function HalamanRombel() {
  return <TabelRombel awal={await listRombel()} />
}