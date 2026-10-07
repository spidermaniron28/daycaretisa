import { notFound } from 'next/navigation'
import { listSiswa, pengaturanAman, laporanById } from '@/lib/sheets'
import { bacaSession } from '@/lib/session'
import { FormLaporan } from '@/components/laporan/form-laporan'

export const dynamic = 'force-dynamic'

export default async function GuruLaporan({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const session = await bacaSession()
  const [siswa, pengaturan, params] = await Promise.all([
    listSiswa(),
    pengaturanAman(),
    searchParams,
  ])

  let awal = null
  if (params.edit) {
    const ketemu = await laporanById(params.edit)
    // Guru hanya boleh menyunting laporan miliknya sendiri.
    if (!ketemu || ketemu.laporan.guruNip !== session?.idAsli) notFound()
    awal = ketemu.laporan
  }

  return (
    <FormLaporan
      siswa={siswa}
      nipGuru={session?.idAsli ?? ''}
      awal={awal}
      kirimEmailDefault={pengaturan.email_notifikasi_aktif === 'YA'}
    />
  )
}