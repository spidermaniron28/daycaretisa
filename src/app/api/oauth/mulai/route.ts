import { handler, ok } from '@/lib/api'
import { wajibRole } from '@/lib/session'
import { buatState } from '@/lib/oauth-token'
import { urlConsent, redirectUriApp } from '@/lib/oauth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Langkah 1 "Hubungkan Ulang Drive": siapkan URL consent Google.
 *
 * Origin diambil dari request supaya alamat callback selalu cocok dengan tempat
 * aplikasi benar-benar berjalan (localhost:3000, atau port lain saat dev).
 * URL callback ini WAJIB terdaftar di Google Cloud → Clients → Authorized
 * redirect URIs, dan nilainya dikembalikan ke UI supaya bisa ditampilkan.
 */
export const POST = handler(async (req: Request) => {
  await wajibRole('admin')

  const origin = new URL(req.url).origin
  const state = buatState()

  return ok({
    url: urlConsent(origin, state),
    redirectUri: redirectUriApp(origin),
  })
})
