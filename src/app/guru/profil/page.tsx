import { guruByNip } from '@/lib/sheets'
import { bacaSession } from '@/lib/session'
import { FormProfilGuru } from '@/components/guru/form-profil'

export const dynamic = 'force-dynamic'

export default async function GuruProfil() {
  const session = await bacaSession()
  return <FormProfilGuru awal={await guruByNip(session?.idAsli ?? '')} />
}