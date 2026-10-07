import { handler, ok, gagal } from '@/lib/api'
import { loginSchema } from '@/lib/validate'
import { login } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const POST = handler(async (req: Request) => {
  const body = loginSchema.parse(await req.json())
  const hasil = await login(body.role, body.username, body.password)

  if (!hasil.ok) return gagal(hasil.message, 401)

  const redirect =
    hasil.session.role === 'admin'
      ? '/admin'
      : hasil.session.role === 'guru'
        ? '/guru'
        : '/ortu'

  return ok({ role: hasil.session.role, redirect })
})