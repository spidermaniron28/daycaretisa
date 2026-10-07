import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

/* ---------------------------------------------------------------------------
 * Penjaga gerbang (Next 16 memakai konvensi "proxy", bukan "middleware").
 *
 * Proxy hanya memeriksa KEADAAN login (apakah cookie valid), bukan hak akses
 * per role — decoding JWT di Edge Runtime harus tanpa dependensi Node.
 * Pemeriksaan role yang sesungguhnya dilakukan lagi di server lewat
 * wajibRole() pada setiap route handler dan server component.
 * ------------------------------------------------------------------------- */

const PUBLIK = ['/login', '/api/auth/login']

const KETENTUAN_PER_PORTAL: Array<{ prefix: string; role: string }> = [
  { prefix: '/admin', role: 'admin' },
  { prefix: '/guru', role: 'guru' },
  { prefix: '/ortu', role: 'siswa' },
]

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  // Kalau belum diset, proxy tidak boleh memblokir seluruh situs; error yang
  // jelas akan muncul di halaman login saat cookie dibaca.
  return new TextEncoder().encode(secret ?? 'dev-secret-dev-secret-dev-secret-dev')
}

function beranda(role: string): string {
  return role === 'admin' ? '/admin' : role === 'guru' ? '/guru' : '/ortu'
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIK.some((p) => pathname === p)) return NextResponse.next()

  const token = req.cookies.get('erapor_session')?.value
  let role: string | null = null

  if (token) {
    try {
      const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] })
      role = String(payload.role ?? '')
    } catch {
      role = null
    }
  }

  // Belum login → lempar ke halaman login, simpan tujuan untuk redirect balik.
  if (!role) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  // Sudah login tapi membuka portal yang bukan haknya.
  const aturan = KETENTUAN_PER_PORTAL.find((r) => pathname.startsWith(r.prefix))
  if (aturan && aturan.role !== role) {
    const url = req.nextUrl.clone()
    url.pathname = beranda(role)
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}