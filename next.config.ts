import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Hide the dev-tools "N / 1 Issue" badge in the corner (dev only).
  devIndicators: false,
  // googleapis & exceljs are heavy CJS deps — keep them external to the server bundle.
  serverExternalPackages: ['googleapis', 'exceljs', 'nodemailer'],
  experimental: {
    // report/laporan payloads carry base64 photos; give them room.
    serverActions: { bodySizeLimit: '12mb' },
    // Simpan payload RSC halaman di cache router sisi klien, sehingga berpindah
    // menu terasa instan dan tidak perlu menunggu server setiap kali klik.
    // dynamic: halaman yang dirender di server (force-dynamic).
    // static: halaman yang di-prefetch penuh lewat <Link prefetch>.
    staleTimes: { dynamic: 30, static: 60 },
  },
}

export default nextConfig