/**
 * Hubungkan akun Google pemilik folder FOTO PROFIL ke aplikasi (OAuth).
 *
 * Dijalankan SEKALI:
 *   1. npm run oauth:drive
 *   2. Browser terbuka → login akun Google yang memiliki folder "FOTO PROFIL"
 *   3. Setuju (Google akan menampilkan "not verified" — app ini pribadi;
 *      klik Advanced → Go to E-Rapor Daycare (unsafe) → Allow)
 *   4. Skrip menulis GOOGLE_OAUTH_REFRESH_TOKEN ke .env.local lalu selesai.
 *
 * Token hasilnya dipakai src/lib/oauth.ts untuk upload foto sebagai akun
 * Anda sendiri (bukan Service Account yang tidak punya kuota Drive).
 */

import http from 'node:http'
import { exec } from 'node:child_process'
import { URL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { google } from 'googleapis'
import { bacaEnvFile, setEnvVar, tulisEnvFile } from './lib/env-file'

const ENV_FILE = '.env.local'
const REDIRECT_PORT = 3777
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/oauth2callback`
const SCOPES = ['https://www.googleapis.com/auth/drive.file']

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error(
    'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET belum terisi di .env.local.\n' +
      'Buat OAuth Client ID (type: Web application) di Google Cloud Console → APIs & Services → Credentials,\n' +
      'lalu tambahkan redirect URI: ' + REDIRECT_URI,
  )
  process.exit(1)
}

const oauth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth2callback')) {
    res.writeHead(404).end()
    return
  }

  try {
    const code = new URL(req.url, REDIRECT_URI).searchParams.get('code')
    if (!code) throw new Error('Google tidak mengirim authorization code.')

    const { tokens } = await oauth.getToken({ code })
    if (!tokens.refresh_token) {
      throw new Error(
        'Google tidak mengembalikan refresh_token. Hapus izin app di myaccount.google.com/permissions ' +
          'lalu jalankan ulang skrip ini.',
      )
    }

    const isi = bacaEnvFile(ENV_FILE)
    tulisEnvFile(
      ENV_FILE,
      setEnvVar(setEnvVar(isi, 'GOOGLE_OAUTH_REFRESH_TOKEN', tokens.refresh_token), 'GOOGLE_OAUTH_CONNECTED_AT', new Date().toISOString()),
    )

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      '<h2>✅ Berhasil!</h2><p>Google Drive sudah terhubung ke E-Rapor. Silakan kembali ke terminal.</p>',
    )

    console.log('\n✅ Refresh token tersimpan di .env.local — Google Drive terhubung.')
    console.log('   Sekarang upload Foto Profil lewat tombol "Ganti Foto" di aplikasi.\n')
  } catch (e) {
    console.error('\n❌ Gagal:', (e as Error).message)
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<h2>❌ Gagal</h2><p>Cek output terminal untuk detail.</p>')
  } finally {
    server.close()
    process.exit(0)
  }
})

server.listen(REDIRECT_PORT, '127.0.0.1', () => {
  const authUrl = oauth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // paksa Google mengirim refresh_token
    state: randomUUID(),
  })

  console.log('Membuka browser untuk login akun Google...')
  console.log('(Bila browser tidak terbuka, tempel URL ini ke browser secara manual)\n')
  console.log(authUrl + '\n')

  if (process.platform === 'win32') {
    exec(`start "" "${authUrl}"`)
  } else {
    exec(`xdg-open "${authUrl}"`)
  }
})
