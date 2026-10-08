import { listSaranByNis } from '@/lib/sheets'
import { bacaSession } from '@/lib/session'
import { SaranOrtu } from '@/components/ortu/saran-ortu'

export const dynamic = 'force-dynamic'

export default async function HalamanSaranOrtu() {
  const session = await bacaSession()
  const saran = await listSaranByNis(session?.idAsli ?? '')

  return <SaranOrtu awal={saran} />
}
