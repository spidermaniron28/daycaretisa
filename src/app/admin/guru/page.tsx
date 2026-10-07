import { listGuru } from '@/lib/sheets'
import { TabelGuru } from '@/components/guru/tabel-guru'

export const dynamic = 'force-dynamic'

export default async function HalamanGuru() {
  return <TabelGuru awal={await listGuru()} />
}