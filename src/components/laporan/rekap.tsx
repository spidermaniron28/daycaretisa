'use client'

import { useMemo, useState } from 'react'
import { Download, Printer, CalendarDays, Filter, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Kosong } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/modal'
import { DetailLaporan, type InfoGuru } from '@/components/laporan/detail-laporan'
import { angka, labelKelas } from '@/lib/utils'
import { KOSONG } from '@/lib/constants'
import type { DataLaporan, Siswa } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Rekap laporan untuk admin.
 *
 * Dua cara membawa data keluar:
 *  - Unduh Excel (.xlsx) lewat /api/laporan/export
 *  - Cetak / simpan PDF lewat dialog cetak browser (gaya di @media print)
 * ------------------------------------------------------------------------- */

interface Props {
  laporan: Array<{ siswa: Siswa; laporan: DataLaporan[] }>
  rombel: Array<{ kode: string; nama: string }>
  namaSekolah: string
  /** Data guru penginput per laporan (kunci = id laporan) — untuk atribusi. */
  guruPerLaporan?: Record<string, InfoGuru | undefined>
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function RekapLaporan({ laporan, rombel, namaSekolah, guruPerLaporan = {} }: Props) {
  const sekarang = new Date()
  const [bulan, setBulan] = useState(sekarang.getMonth() + 1)
  const [tahun, setTahun] = useState(sekarang.getFullYear())
  const [kelas, setKelas] = useState('')
  const [siswaFilter, setSiswaFilter] = useState('')
  const [unduh, setUnduh] = useState(false)
  const [lihat, setLihat] = useState<{ l: DataLaporan; s: Siswa } | null>(null)

  const prefix = `${tahun}-${String(bulan).padStart(2, '0')}`

  const tersaring = useMemo(
    () =>
      laporan
        .map(({ siswa: s, laporan: daftar }) => ({
          siswa: s,
          laporan: daftar.filter(
            (l) =>
              l.tanggal.startsWith(prefix) &&
              (!kelas || s.kelas === kelas) &&
              (!siswaFilter || s.nis === siswaFilter),
          ),
        }))
        .filter((x) => x.laporan.length > 0),
    [laporan, prefix, kelas, siswaFilter],
  )

  const semuaAnak = useMemo(() => {
    const map = new Map<string, Siswa>()
    for (const { siswa: s } of laporan) map.set(s.nis, s)
    return [...map.values()]
  }, [laporan])

  const urlExport = `/api/laporan/export?bulan=${bulan}&tahun=${tahun}${
    kelas ? `&kelas=${encodeURIComponent(kelas)}` : ''
  }${siswaFilter ? `&nis=${encodeURIComponent(siswaFilter)}` : ''}`

  async function unduhExcel() {
    setUnduh(true)
    try {
      const res = await fetch(urlExport)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Gagal mengunduh file.')
        return
      }
      const blob = await res.blob()
      const nama = `Rekap-Laporan-${prefix}.xlsx`

      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = nama
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(link.href)

      toast.success('File Excel berhasil diunduh.')
    } catch {
      toast.error('Gagal mengunduh file.')
    } finally {
      setUnduh(false)
    }
  }

  const perAnak = useMemo(
    () =>
      [...tersaring].sort((a, b) => a.siswa.nis.localeCompare(b.siswa.nis)),
    [tersaring],
  )

  return (
    <div className="space-y-6">
      {/* ------------------------------ Filter ----------------------------- */}
      <div className="cetak-sembunyi kartu p-5 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="kolom-label">Bulan</label>
            <select
              className="kolom w-auto"
              value={bulan}
              onChange={(e) => setBulan(Number(e.target.value))}
            >
              {BULAN.map((b, i) => (
                <option key={b} value={i + 1}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="kolom-label">Tahun</label>
            <select
              className="kolom w-auto"
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
            >
              {[sekarang.getFullYear() - 2, sekarang.getFullYear() - 1, sekarang.getFullYear()].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label className="kolom-label">Kelas</label>
            <select className="kolom w-auto" value={kelas} onChange={(e) => setKelas(e.target.value)}>
              <option value="">Semua Kelas</option>
              {rombel.map((r) => (
                <option key={r.kode} value={r.kode}>
                  {labelKelas(r.kode, r.nama)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="kolom-label">Anak</label>
            <select
              className="kolom w-auto"
              value={siswaFilter}
              onChange={(e) => setSiswaFilter(e.target.value)}
            >
              <option value="">Semua Anak</option>
              {semuaAnak.map((s) => (
                <option key={s.nis} value={s.nis}>
                  {s.nis} — {s.nama}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 w-full lg:w-auto">
          <button type="button" onClick={unduhExcel} disabled={unduh} className="tombol-hijau flex-1">
            <Download className="w-4 h-4" />
            {unduh ? 'Menyiapkan...' : 'Unduh Excel'}
          </button>
          <button type="button" onClick={() => window.print()} className="tombol-garis flex-1">
            <Printer className="w-4 h-4" />
            Cetak / PDF
          </button>
        </div>
      </div>

      {/* ------------------------- Kop yang ikut cetak ---------------------- */}
      <div className="cetak-sembunyi flex items-center gap-2 text-gray-500">
        <Filter className="w-4 h-4" />
        <span className="text-[13px]">
          {tersaring.length} laporan · {perAnak.length} anak
        </span>
      </div>

      {tersaring.length === 0 ? (
        <Kosong
          judul="Tidak ada laporan pada periode ini"
          pesan="Coba pilih bulan, tahun, atau kelas yang lain."
        />
      ) : (
        <>
          {/* -------------------------- Rekap kasar -------------------------- */}
          <div className="kartu overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-[15px] text-gray-800">
                Rekap Kehadiran per Anak
              </h2>
              <p className="text-[12px] text-gray-500 mt-0.5">
                {namaSekolah} · {BULAN[bulan - 1]} {tahun}
                {kelas ? ` · Kelas ${kelas}` : ''}
              </p>
            </div>

            <div className="overflow-x-auto area-cetak">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[13px] font-semibold text-gray-500">
                    <th scope="col" className="px-6 py-3 text-left font-semibold w-[100px]">NIS</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Nama Anak</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold w-[80px]">Kelas</th>
                    <th scope="col" className="px-4 py-3 text-center font-semibold w-[110px]">Jumlah Laporan</th>
                    <th scope="col" className="px-6 py-3 text-center font-semibold w-[180px]">Tanggal Tercatat</th>
                  </tr>
                </thead>
                <tbody>
                  {perAnak.map(({ siswa: s, laporan }) => (
                    <tr key={s.nis} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors cetak-pecah">
                      <td className="px-6 py-4 text-[13px] font-medium text-gray-700 align-middle">{s.nis}</td>
                      <td className="px-4 py-4 text-[13px] font-semibold text-gray-800 truncate align-middle">{s.nama}</td>
                      <td className="px-4 py-4 text-[13px] align-middle">{s.kelas}</td>
                      <td className="px-4 py-4 text-[13px] text-center font-semibold text-blue-700 align-middle">
                        {angka(laporan.length)}
                      </td>
                      <td className="px-6 py-4 text-[12px] text-center text-gray-500 align-middle">
                        {laporan[0]?.tanggal} — {laporan[laporan.length - 1]?.tanggal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ----------------------------- Detail ---------------------------- */}
          <div className="space-y-6">
            {perAnak.map(({ siswa: s, laporan }) => (
              <section key={s.nis} className="kartu overflow-hidden cetak-pecah">
                <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                  <h3 className="font-bold text-[14px] text-gray-800">
                    {s.nama}{' '}
                    <span className="font-normal text-gray-500">
                      · {s.nis} · {s.kelas}
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {BULAN[bulan - 1]} {tahun} · {angka(laporan.length)} laporan
                  </p>
                </div>

                <div className="overflow-x-auto area-cetak">
                  <table className="w-full min-w-[900px] text-[12px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-500">
                        <th scope="col" className="px-4 py-3 text-left font-semibold w-[70px]">Tgl</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold w-[60px]">Datang</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold w-[60px]">Pulang</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold">Sarapan</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold">Makan Siang</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold w-[70px]">Tidur</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold">Kesehatan</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold">Catatan</th>
                        <th scope="col" className="px-4 py-3 text-center font-semibold w-[70px] cetak-sembunyi">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laporan.map((l) => (
                        <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors text-[11.5px]">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500 align-middle">{l.tanggal}</td>
                          <td className="px-4 py-3 text-gray-700 align-middle">{l.datang}</td>
                          <td className="px-4 py-3 text-gray-700 align-middle">{l.pulang}</td>
                          <td className="px-4 py-3 truncate max-w-[160px] align-middle" title={bersihkan(l.sarapan.menu)}>
                            {bersihkan(l.sarapan.menu) || sel('—')}
                          </td>
                          <td className="px-4 py-3 truncate max-w-[160px] align-middle" title={bersihkan(l.siang.menu)}>
                            {bersihkan(l.siang.menu) || sel('—')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap align-middle">
                            {bersihkan(l.tidur.durasi) || sel('—')}
                          </td>
                          <td className="px-4 py-3 truncate max-w-[140px] align-middle">
                            {bersihkan(l.kesehatan.kondisi) || sel('—')}
                          </td>
                          <td className="px-6 py-3 truncate max-w-[200px] align-middle" title={bersihkan(l.perilaku.catatanPengasuh)}>
                            {bersihkan(l.perilaku.catatanPengasuh) || sel('—')}
                          </td>
                          <td className="px-4 py-3 text-center align-middle cetak-sembunyi">
                            <button
                              type="button"
                              onClick={() => setLihat({ l, s })}
                              aria-label={`Lihat laporan ${s.nama} tanggal ${l.tanggal}`}
                              title="Lihat laporan lengkap"
                              className="w-8 h-8 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md inline-flex items-center justify-center transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {/* ------------- Modal "Lihat" — persis tampilan orang tua ------------ */}
      <Modal
        open={lihat !== null}
        onClose={() => setLihat(null)}
        title={lihat ? `Laporan ${lihat.s.nama} · ${lihat.l.tanggal}` : ''}
        deskripsi={
          lihat
            ? `Tampilan yang sama seperti yang dilihat orang tua di jurnal harian.`
            : undefined
        }
        lebar="lg"
        footer={
          <button type="button" className="tombol-biru" onClick={() => setLihat(null)}>
            Tutup
          </button>
        }
      >
        {lihat && (
          <DetailLaporan l={lihat.l} guru={guruPerLaporan[lihat.l.id] ?? null} />
        )}
      </Modal>
    </div>
  )
}

function bersihkan(v: string): string {
  return !v || v === KOSONG ? '' : v
}

function sel(teks: string) {
  return <span className="text-gray-300">{teks}</span>
}