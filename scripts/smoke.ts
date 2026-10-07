/**
 * Smoke test: memanggil setiap endpoint API satu per satu untuk memastikan
 * tidak ada yang rusak sebelum aplikasi dideploy ke Vercel.
 *
 * CARA PAKAI:
 *   Terminal 1:  npm run dev
 *   Terminal 2:  npm run smoke
 *
 * Credential admin bisa diatur lewat:
 *   SMOKE_ADMIN_USER=admin SMOKE_ADMIN_PASS=12345 npm run smoke
 */

const BASE = process.env.SMOKE_URL ?? 'http://localhost:3000'
const ADMIN_USER = process.env.SMOKE_ADMIN_USER ?? 'admin'
const ADMIN_PASS = process.env.SMOKE_ADMIN_PASS ?? '12345'

let cookie = ''
let lulus = 0
let gagal = 0

interface HasilPanggil {
  status: number
  json: unknown
}

async function panggil(
  metode: string,
  jalur: string,
  body?: unknown,
): Promise<HasilPanggil> {
  const res = await fetch(`${BASE}${jalur}`, {
    method: metode,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })

  const setCookie = res.headers.get('set-cookie')
  if (setCookie?.includes('erapor_session')) cookie = setCookie

  const teks = await res.text()
  let json: unknown
  try {
    json = JSON.parse(teks)
  } catch {
    json = { _teks: teks.slice(0, 120) }
  }
  return { status: res.status, json }
}

/** Ambil field dari objek JSON hasil panggil, dengan tipe aman. */
function field(json: unknown, nama: string): string {
  if (typeof json === 'object' && json !== null && nama in json) {
    const nilai = (json as Record<string, unknown>)[nama]
    if (typeof nilai === 'string') return nilai
  }
  return JSON.stringify(json).slice(0, 160)
}

async function cek(nama: string, fn: () => Promise<void>) {
  try {
    await fn()
    lulus++
    console.log(`  \u2713 ${nama}`)
  } catch (e) {
    gagal++
    console.log(`  \u2717 ${nama} — ${(e as Error).message}`)
  }
}

function harus(condition: unknown, pesan: string) {
  if (!condition) throw new Error(pesan)
}

async function utama() {
  console.log(`Smoke test → ${BASE}\n`)

  console.log('Autentikasi')
  await cek('Halaman login bisa diakses', async () => {
    const res = await fetch(`${BASE}/login`)
    harus(res.status === 200, `status ${res.status}`)
  })

  await cek('Tolak login dengan password salah', async () => {
    const { status } = await panggil('POST', '/api/auth/login', {
      role: 'admin',
      username: ADMIN_USER,
      password: 'password-salah-sekali',
    })
    harus(status === 401, `harusnya 401, dapat ${status}`)
  })

  await cek('API menolak tanpa session', async () => {
    const { status } = await panggil('GET', '/api/siswa')
    harus(status === 401, `harusnya 401, dapat ${status}`)
  })

  await cek('Login admin berhasil', async () => {
    const { status, json } = await panggil('POST', '/api/auth/login', {
      role: 'admin',
      username: ADMIN_USER,
      password: ADMIN_PASS,
    })
    harus(status === 200, `status ${status}: ${field(json, 'error')}`)
    harus(cookie !== '', 'cookie session tidak dibuat')
  })

  console.log('\nHalaman portal')
  for (const halaman of ['/admin', '/admin/siswa', '/admin/guru', '/admin/rombel', '/admin/akun', '/admin/sistem', '/admin/laporan']) {
    await cek(halaman, async () => {
      const res = await fetch(`${BASE}${halaman}`, {
        headers: { Cookie: cookie },
        redirect: 'manual',
      })
      harus(res.status === 200, `status ${res.status}`)
    })
  }

  console.log('\nEndpoint baca')
  const endpoints: Array<[string, string]> = [
    ['GET', '/api/siswa'],
    ['GET', '/api/guru'],
    ['GET', '/api/rombel'],
    ['GET', '/api/akun'],
    ['GET', '/api/pengaturan'],
    ['GET', '/api/laporan'],
  ]

  for (const [metode, jalur] of endpoints) {
    await cek(`${metode} ${jalur}`, async () => {
      const { status } = await panggil(metode, jalur)
      harus(status === 200, `status ${status}`)
    })
  }

  console.log('\nValidasi input')
  await cek('Tolak siswa tanpa nama', async () => {
    const { status } = await panggil('POST', '/api/siswa', { nis: '', nama: '' })
    harus(status === 422, `harusnya 422, dapat ${status}`)
  })

  await cek('Tolak akun dengan sandi pendek', async () => {
    const { status } = await panggil('POST', '/api/akun', {
      role: 'siswa',
      username: 'uji-sandi',
      password: '123',
    })
    harus(status === 422, `harusnya 422, dapat ${status}`)
  })

  console.log('\nEkspor')
  await cek('Endpoint export merespons (200 atau 404)', async () => {
    const { status } = await panggil('GET', '/api/laporan/export?bulan=1&tahun=2020')
    harus([200, 404].includes(status), `status ${status}`)
  })

  console.log('\nKeluar')
  await cek('Logout berhasil', async () => {
    const { status } = await panggil('POST', '/api/auth/logout')
    harus(status === 200, `status ${status}`)
  })

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal.`)
  if (gagal > 0) process.exit(1)
}

utama().catch((e) => {
  console.error('\nGagal menjalankan smoke test:', e.message)
  console.error('Pastikan `npm run dev` sudah berjalan di terminal lain.')
  process.exit(1)
})