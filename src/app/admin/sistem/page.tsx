import { headers } from 'next/headers'
import { listPengaturan } from '@/lib/sheets'
import { FormPengaturan } from '@/components/pengaturan/form-pengaturan'
import { KartuKoneksi } from '@/components/pengaturan/kartu-koneksi'
import { statusKoneksi } from '@/lib/kesehatan'
import { redirectUriApp } from '@/lib/oauth'

export const dynamic = 'force-dynamic'

export default async function HalamanSistem() {
  const [pengaturan, koneksi] = await Promise.all([listPengaturan(), statusKoneksi()])

  // Alamat callback dihitung dari request yang sedang berjalan supaya panel
  // menampilkan alamat yang PERSIS sama dengan yang akan dipakai Google —
  // baik saat dibuka lewat localhost maupun lewat 127.0.0.1 / alamat LAN.
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const protokol = h.get('x-forwarded-proto') ?? 'http'
  const redirectUri = redirectUriApp(`${protokol}://${host}`)

  return (
    <div className="space-y-6 max-w-5xl">
      <FormPengaturan awal={pengaturan} />
      {/* Status koneksi ditaruh paling bawah, di bawah Pengaturan Sistem. */}
      <KartuKoneksi awal={koneksi} redirectUri={redirectUri} />
    </div>
  )
}
