import { listSaran } from '@/lib/sheets'
import { TabelSaran } from '@/components/admin/tabel-saran'

export const dynamic = 'force-dynamic'

export default async function HalamanSaran() {
  return <TabelSaran awal={await listSaran()} />
}
