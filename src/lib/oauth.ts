import 'server-only'
import { google, drive_v3 } from 'googleapis'
import { pastikanTokenDimuat, refreshTokenAktif } from './oauth-token'

/* ---------------------------------------------------------------------------
 * OAuth akun pemilik (bukan Service Account).
 *
 * Sejak 2025 Service Account tidak punya kuota penyimpanan Drive, sehingga
 * files.create selalu 403 walau folder sudah di-share ke SA (terverifikasi
 * lewat probe). Solusi resmi Google: OAuth delegation — app memakai izin
 * akun Google pemilik sekolah, sehingga file yang diunggah DIMILIKI akun itu
 * (memakai kuota-nya) dan mendarat di folder miliknya sendiri.
 *
 * Refresh token dibaca lewat src/lib/oauth-token.ts: nilai hasil tombol
 * "Hubungkan Ulang Drive" di aplikasi menang atas nilai di .env.local.
 * ------------------------------------------------------------------------- */

/** Redirect URI milik skrip terminal (scripts/oauth-drive.ts). */
export const REDIRECT_URI = 'http://127.0.0.1:3777/oauth2callback'

/** Scope minimal: app hanya melihat berkas yang ia sendiri buat. */
export const SCOPE_DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file'

/** URL callback bila hubungkan ulang dilakukan DARI DALAM aplikasi. */
export function redirectUriApp(origin: string): string {
  return `${origin}/api/oauth/callback`
}

/**
 * Cek kredensial OAuth lengkap.
 *
 * `async` karena token bisa berada di spreadsheet (token hasil hubungkan ulang
 * di Vercel); nilainya dimuat dulu sebelum diperiksa.
 */
export async function kredensialOAuthTerisi(): Promise<boolean> {
  await pastikanTokenDimuat()
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      refreshTokenAktif(),
  )
}

/** OAuth2 client dari refresh token aktif (spreadsheet, .env, atau hasil hubungkan ulang). */
async function buatOAuthClient(redirectUri = REDIRECT_URI) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

  await pastikanTokenDimuat()
  const refreshToken = refreshTokenAktif()

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Drive (OAuth) belum terhubung. Klik "Hubungkan Ulang Drive" di halaman ' +
        'Sistem & Akses, atau jalankan "npm run oauth:drive" sekali di lokal.',
    )
  }

  const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  oauth.setCredentials({ refresh_token: refreshToken })
  return oauth
}

/** Drive client yang mengunggah sebagai akun pemilik (bukan SA). */
export async function getDriveOAuth(): Promise<drive_v3.Drive> {
  return google.drive({ version: 'v3', auth: await buatOAuthClient() })
}

/* ------------------------- Hubungkan ulang dari app ---------------------- */

/** Bangun URL consent Google untuk alur di dalam aplikasi. */
export function urlConsent(origin: string, state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET belum diisi di .env.local.')
  }

  const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUriApp(origin))
  return oauth.generateAuthUrl({
    access_type: 'offline',
    scope: [SCOPE_DRIVE_FILE],
    prompt: 'consent', // paksa Google mengirim refresh_token
    state,
  })
}

/** Tukar authorization code dari Google menjadi refresh token baru. */
export async function tukarCode(code: string, origin: string): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET belum diisi di .env.local.')
  }

  const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUriApp(origin))
  const { tokens } = await oauth.getToken({ code })

  if (!tokens.refresh_token) {
    throw new Error(
      'Google tidak mengembalikan refresh_token. Cabut izin app di myaccount.google.com/permissions, ' +
        'lalu klik Hubungkan Ulang Drive lagi.',
    )
  }
  return tokens.refresh_token
}
