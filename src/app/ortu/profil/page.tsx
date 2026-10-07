import { siswaByNis } from '@/lib/sheets'
import { bacaSession } from '@/lib/session'
import { FormProfilOrangTua } from '@/components/siswa/form-profil-ortu'

export const dynamic = 'force-dynamic'

export default async function OrtuProfil() {
  const session = await bacaSession()
  return <FormProfilOrangTua awal={await siswaByNis(session?.idAsli ?? '')} />
}