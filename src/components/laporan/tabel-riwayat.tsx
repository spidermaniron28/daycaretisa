'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Mail, MailCheck, MailWarning, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Konfirmasi, Modal } from '@/components/ui/modal'
import { Kosong } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import type { DataLaporan, Siswa } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Riwayat laporan milik guru.
 *
 * Aksi edit memakai UUID laporan, BUKAN nomor baris spreadsheet. Di aplikasi
 * lama nomor baris dipakai sebagai identitas — begitu ada baris yang dihapus,
 * semua nomor baris di bawahnya bergeser dan edit bisa membuka laporan anak
 * yang salah.
 * ------------------------------------------------------------------------- */

interface Props {
  laporan: DataLaporan[]
  siswa: Siswa[]
}

function namaAnak(nis: string, siswa: Siswa[]): string {
  return siswa.find((s) => s.nis === nis)?.nama ?? nis
}

export function TabelRiwayat({ laporan, siswa }: Props) {
  const router = useRouter()
  const [cari, setCari] = useState('')
  const [hapus, setHapus] = useState<DataLaporan | null>(null)
  const [lihat, setLihat] = useState<DataLaporan | null>(null)
  const [sibuk, setSibuk] = useState(false)

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase()
    if (!q) return laporan
    return laporan.filter((l) =>
      [l.tanggal, l.nis, namaAnak(l.nis, siswa), l.penjemput].some((v) =>
        v.toLowerCase().includes(q),
      ),
    )
  }, [laporan, cari, siswa])

  async function konfirmasiHapus() {
    if (!hapus) return
    setSibuk(true)
    try {
      const res = await fetch(`/api/laporan/${encodeURIComponent(hapus.id)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menghapus laporan.')
        return
      }
      toast.success('Laporan berhasil dihapus.')
      setHapus(null)
      router.refresh()
    } catch {
      toast.error('Gagal terhubung ke server.')
    } finally {
      setSibuk(false)
    }
  }

  async function kirimUlang(l: DataLaporan) {
    setSibuk(true)
    try {
      const res = await fetch('/api/notifikasi/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: l.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.pesan ?? json.error ?? 'Gagal mengirim email.')
        return
      }
      toast.success('Email berhasil dikirim ke orang tua.')
      router.refresh()
    } catch {
      toast.error('Gagal terhubung ke server.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="kartu overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 md:p-6 border-b border-gray-100">
          <h2 className="font-bold text-[15px] text-gray-800 shrink-0">
            Riwayat Laporan ({tersaring.length}/{laporan.length})
          </h2>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari tanggal atau nama anak..."
              className="kolom pl-9 py-2 text-[13px]"
            />
          </div>
        </div>

        {tersaring.length === 0 ? (
          <Kosong
            judul={laporan.length === 0 ? 'Belum ada laporan' : 'Tidak ada hasil yang cocok'}
            pesan={
              laporan.length === 0
                ? 'Mulai dengan mengisi laporan harian pertama di menu Input Laporan.'
                : undefined
            }
          />
        ) : (
          <>
            {/* Mobile: kartu per laporan */}
            <ul className="md:hidden divide-y divide-gray-100">
              {tersaring.map((l, i) => (
                <li key={l.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] text-gray-400 tabular-nums pt-0.5 w-6 shrink-0">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-gray-800 truncate">
                        {namaAnak(l.nis, siswa)}
                      </p>
                      <p className="text-[12px] text-gray-500 mt-0.5">{l.tanggal}</p>
                    </div>
                    <LencanaNotifikasi status={l.notifikasi} />
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-9">
                    <div className="flex items-center gap-2 min-w-0 text-[12px]">
                      <span className="text-green-600 font-semibold shrink-0">{l.datang}</span>
                      <span className="text-gray-300">—</span>
                      <span className="text-orange-500 font-semibold shrink-0">{l.pulang}</span>
                      {l.fotoKegiatan.length > 0 && (
                        <span className="text-[11px] text-gray-400 shrink-0">
                          {l.fotoKegiatan.length} foto
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setLihat(l)}
                        title="Lihat"
                        className="text-[11px] bg-gray-50 hover:bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-md font-medium transition-colors"
                      >
                        Lihat
                      </button>
                      <Link
                        href={`/guru/laporan?edit=${encodeURIComponent(l.id)}`}
                        title="Ubah"
                        className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-600 px-2.5 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        Ubah
                      </Link>
                      <button
                        type="button"
                        onClick={() => kirimUlang(l)}
                        disabled={sibuk}
                        title="Kirim ulang email ke orang tua"
                        aria-label="Kirim ulang email"
                        className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1.5 rounded-md font-medium transition-colors inline-flex items-center"
                      >
                        <Mail className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setHapus(l)}
                        aria-label={`Hapus laporan ${l.tanggal}`}
                        title="Hapus"
                        className="text-[11px] bg-red-50 hover:bg-red-100 text-red-500 px-2 py-1.5 rounded-md font-medium transition-colors inline-flex items-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop/md+: tabel thead asli */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[13px] font-semibold text-gray-500">
                    <th scope="col" className="px-6 py-3 text-left font-semibold w-[56px]">No</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold w-[120px]">Tanggal</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Anak</th>
                    <th scope="col" className="px-4 py-3 text-center font-semibold w-[150px]">Datang — Pulang</th>
                    <th scope="col" className="px-4 py-3 text-center font-semibold w-[70px]">Foto</th>
                    <th scope="col" className="px-4 py-3 text-center font-semibold w-[110px]">Notifikasi</th>
                    <th scope="col" className="px-6 py-3 text-right font-semibold w-[170px]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tersaring.map((l, i) => (
                    <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 text-[13px] text-gray-400 tabular-nums align-middle">{i + 1}</td>
                      <td className="px-4 py-4 text-[13px] font-medium text-gray-700 align-middle">{l.tanggal}</td>
                      <td className="px-4 py-4 text-[13px] font-semibold text-gray-800 truncate align-middle">
                        {namaAnak(l.nis, siswa)}
                      </td>
                      <td className="px-4 py-4 text-center text-[12px] align-middle">
                        <span className="text-green-600 font-semibold">{l.datang}</span>
                        <span className="text-gray-300 mx-1">—</span>
                        <span className="text-orange-500 font-semibold">{l.pulang}</span>
                      </td>
                      <td className="px-4 py-4 text-center text-[12px] text-gray-500 align-middle">
                        {l.fotoKegiatan.length > 0 ? l.fotoKegiatan.length : '—'}
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        <LencanaNotifikasi status={l.notifikasi} />
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setLihat(l)}
                            className="text-[11px] bg-gray-50 hover:bg-gray-100 text-gray-600 px-2 py-1.5 rounded-md font-medium transition-colors"
                          >
                            Lihat
                          </button>
                          <Link
                            href={`/guru/laporan?edit=${encodeURIComponent(l.id)}`}
                            className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-600 px-2 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" />
                            Ubah
                          </Link>
                          <button
                            type="button"
                            onClick={() => kirimUlang(l)}
                            disabled={sibuk}
                            title="Kirim ulang email ke orang tua"
                            className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1.5 rounded-md font-medium transition-colors inline-flex items-center"
                          >
                            <Mail className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setHapus(l)}
                            aria-label={`Hapus laporan ${l.tanggal}`}
                            className="text-[11px] bg-red-50 hover:bg-red-100 text-red-500 px-2 py-1.5 rounded-md font-medium transition-colors inline-flex items-center"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Konfirmasi
        open={hapus !== null}
        onClose={() => !sibuk && setHapus(null)}
        onKonfirmasi={konfirmasiHapus}
        judul="Hapus Laporan"
        pesan={`Hapus laporan ${namaAnak(hapus?.nis ?? '', siswa)} tanggal ${hapus?.tanggal}? Laporan ini akan hilang dari portal orang tua.`}
        labelKonfirmasi="Ya, Hapus"
        sibuk={sibuk}
      />

      <Modal
        open={lihat !== null}
        onClose={() => setLihat(null)}
        title={`Laporan ${lihat?.tanggal ?? ''}`}
        lebar="lg"
        footer={
          <button type="button" className="tombol-garis" onClick={() => setLihat(null)}>
            Tutup
          </button>
        }
      >
        {lihat && <RingkasanLaporan l={lihat} namaAnak={namaAnak(lihat.nis, siswa)} />}
      </Modal>
    </div>
  )
}

function LencanaNotifikasi({ status }: { status: string }) {
  if (status === 'TERKIRIM') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded">
        <MailCheck className="w-3 h-3" />
        Terkirim
      </span>
    )
  }
  if (status === 'GAGAL') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded">
        <MailWarning className="w-3 h-3" />
        Gagal
      </span>
    )
  }
  return <span className="text-[11px] text-gray-300">—</span>
}

/** Ringkasan read-only, dipakai dialog "Lihat". */
export function RingkasanLaporan({ l, namaAnak }: { l: DataLaporan; namaAnak: string }) {
  const meals = [
    { judul: 'Sarapan', m: l.sarapan },
    { judul: 'Camilan Pagi', m: l.campagi },
    { judul: 'Makan Siang', m: l.siang },
    { judul: 'Camilan Sore', m: l.camsore },
  ]

  return (
    <div className="space-y-5 text-[13px]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Info label="Anak" nilai={namaAnak} />
        <Info label="Datang" nilai={l.datang} />
        <Info label="Pulang" nilai={l.pulang} />
        <Info label="Penjemput" nilai={l.penjemput} />
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 mb-2">Asupan Nutrisi</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {meals.map(({ judul, m }) => (
            <div key={judul} className="border border-gray-100 rounded-lg p-3">
              <p className="font-semibold text-gray-700">{judul}</p>
              <p className="text-gray-600">{m.menu}</p>
              {m.catatan && <p className="text-[11px] text-gray-400 italic mt-0.5">{m.catatan}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Info label="Mulai Tidur" nilai={l.tidur.datang} />
        <Info label="Bangun" nilai={l.tidur.bangun} />
        <Info label="Kualitas Tidur" nilai={l.tidur.kualitas} />
        <Info label="Suhu" nilai={l.kesehatan.suhu} />
        <Info label="Kondisi" nilai={l.kesehatan.kondisi} />
        <Info label="Kebersihan" nilai={l.kesehatan.kebersihan} />
      </div>

      {l.perilaku.catatanPengasuh && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
          <p className="font-semibold text-amber-700 mb-1">Catatan Pengasuh</p>
          <p className="text-gray-600">{l.perilaku.catatanPengasuh}</p>
        </div>
      )}

      {l.fotoKegiatan.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">Foto Kegiatan</h4>
          <div className="grid grid-cols-3 gap-2">
            {l.fotoKegiatan.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noopener" className="block">
                <img
                  src={u}
                  alt={`Foto ${i + 1}`}
                  className="w-full aspect-[4/3] object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={cn('text-gray-700 font-medium truncate', nilai === '-' && 'text-gray-300 italic')}>
        {nilai === '-' ? 'Belum diisi' : nilai}
      </p>
    </div>
  )
}