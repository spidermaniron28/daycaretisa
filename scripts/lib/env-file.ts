/**
 * Pembaca/penulis file .env — dipakai scripts/bootstrap.ts.
 *
 * Dipisah dari skrip utama supaya logikanya murni (tidak menyentuh Google)
 * dan bisa diuji sendiri: menimpa satu KEY tidak boleh merusak baris lain,
 * terutama SESSION_SECRET.
 */

import { readFileSync, writeFileSync } from 'node:fs'

export function bacaEnvFile(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    throw new Error(
      `${path} tidak ditemukan. Salin .env.example menjadi ${path} lalu isi kredensial Service Account.`,
    )
  }
}

/**
 * Set atau replace satu KEY=VALUE.
 *
 * three kasus:
 *  - key ada tapi nilainya kosong  → diisi, posisi baris tetap
 *  - key ada dan sudah punya isi  → diganti
 *  - key belum ada                 → ditambahkan di akhir
 *
 * Regex-nya dikunci ke '^KEY=' supaya tidak salah mengenai key lain yang
 * namanya diawali KEY yang sama (mis. GOOGLE_SPREADSHEET_ID vs
 * GOOGLE_SPREADSHEET_ID_LAMA).
 */
export function setEnvVar(isi: string, key: string, value: string): string {
  const pola = new RegExp(`^${key}=.*$`, 'm')
  if (pola.test(isi)) return isi.replace(pola, `${key}=${value}`)
  return `${isi.trimEnd()}\n${key}=${value}\n`
}

export function tulisEnvFile(path: string, isi: string): void {
  writeFileSync(path, isi)
}
