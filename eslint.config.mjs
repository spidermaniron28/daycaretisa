import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Flat config native dari eslint-config-next 16.
 * (Pendekatan lama lewat FlatCompat sudah tidak kompatibel dan melempar
 * "Converting circular structure to JSON".)
 */
const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'out/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      /*
       * Sengaja pakai <img>, bukan next/image.
       *
       * Semua foto profil dan foto kegiatan tinggal di Google Drive dan
       * disajikan lewat URL thumbnail drive.google.com/thumbnail?id=...
       * next/image akan mengunduh ulang berkas itu dari Drive untuk
       * di-optimasi ulang — itu justru menambah beban dan bisa gagal saat
       * Drive sempat rate-limit. Foto sudah dikompres di browser sebelum
       * diunggah, jadi optimasi tambahan tidak memberi manfaat nyata.
       */
      '@next/next/no-img-element': 'off',
    },
  },
]

export default eslintConfig