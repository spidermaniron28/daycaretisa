import { handler, ok } from '@/lib/api'
import { hapusSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export const POST = handler(async () => {
  await hapusSession()
  return ok({ ok: true })
})