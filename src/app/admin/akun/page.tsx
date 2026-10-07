import { listAkun } from '@/lib/sheets'
import { bacaSession } from '@/lib/session'
import { TabelAkun } from '@/components/akun/tabel-akun'

export const dynamic = 'force-dynamic'

export default async function HalamanAkun() {
  const [akun, session] = await Promise.all([listAkun(), bacaSession()])
  return <TabelAkun awal={akun} usernameSendiri={session?.username ?? ''} />
}