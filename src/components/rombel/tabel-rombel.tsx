'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Konfirmasi } from '@/components/ui/modal'
import { Bidang, Kosong } from '@/components/ui/primitives'
import type { Rombel } from '@/lib/types'

const KOSONG = { kode: '', nama: '', wali: '' }

export function TabelRombel({ awal }: { awal: Rombel[] }) {
  const [data, setData] = useState(awal)
  const [form, setForm] = useState<typeof KOSONG | null>(null)
  const [hapus, setHapus] = useState<Rombel | null>(null)
  const [sibuk, setSibuk] = useState(false)

  async function muatUlang() {
    const terbaru = await fetch('/api/rombel').then((r) => r.json())
    if (Array.isArray(terbaru)) setData(terbaru)
  }

  async function simpan() {
    if (!form) return
    if (!form.kode.trim() || !form.nama.trim()) {
      toast.error('Kode dan Nama kelas wajib diisi.')
      return
    }
    setSibuk(true)
    try {
      const res = await fetch('/api/rombel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menyimpan kelas.')
        return
      }
      toast.success('Kelas berhasil ditambahkan.')
      setForm(null)
      await muatUlang()
    } catch {
      toast.error('Gagal terhubung ke server.')
    } finally {
      setSibuk(false)
    }
  }

  async function konfirmasiHapus() {
    if (!hapus) return
    setSibuk(true)
    try {
      const res = await fetch(`/api/rombel?kode=${encodeURIComponent(hapus.kode)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menghapus kelas.')
        return
      }
      toast.success('Kelas berhasil dihapus.')
      setHapus(null)
      await muatUlang()
    } catch {
      toast.error('Gagal terhubung ke server.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="kartu overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 md:p-6 border-b border-gray-100">
        <h2 className="font-bold text-[15px] text-gray-800">
          Daftar Rombongan Belajar ({data.length})
        </h2>
        <button type="button" onClick={() => setForm({ ...KOSONG })} className="tombol-ungu w-full md:w-auto">
          <Plus className="w-4 h-4" />
          Tambah Kelas
        </button>
      </div>

      {data.length === 0 ? (
        <Kosong judul="Belum ada kelas" pesan="Tambahkan kelas agar bisa dipilih pada form data siswa." />
      ) : (
        <>
          {/* Mobile: kartu per kelas */}
          <ul className="md:hidden divide-y divide-gray-100">
            {data.map((r, i) => (
              <li key={r.kode} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-[12px] text-gray-400 tabular-nums pt-0.5 w-6 shrink-0">{i + 1}</span>
                  <span className="bg-purple-50 text-purple-600 border border-purple-100 px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0">
                    {r.kode}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-gray-800 truncate">{r.nama}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5 truncate">
                      Wali: {r.wali || 'Belum ditentukan'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1.5 pl-9">
                  <button
                    type="button"
                    onClick={() => setHapus(r)}
                    aria-label={`Hapus kelas ${r.nama}`}
                    title="Hapus"
                    className="text-[11px] bg-red-50 hover:bg-red-100 text-red-500 px-2.5 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop/md+: tabel thead asli */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[13px] font-semibold text-gray-500">
                  <th scope="col" className="px-6 py-3 text-left font-semibold w-[56px]">No</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold w-[130px]">Kode Kelas</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Nama Kelas</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold w-[160px]">Wali Kelas</th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold w-[80px]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={r.kode} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4 text-[13px] text-gray-400 tabular-nums align-middle">{i + 1}</td>
                    <td className="px-4 py-4 text-[13px] font-medium text-gray-700 align-middle">{r.kode}</td>
                    <td className="px-4 py-4 text-[13px] text-gray-800 font-semibold truncate align-middle">{r.nama}</td>
                    <td className="px-4 py-4 text-[13px] truncate align-middle">{r.wali || <span className="text-gray-300">—</span>}</td>
                    <td className="px-6 py-4 align-middle">
                      <span className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setHapus(r)}
                          aria-label={`Hapus kelas ${r.nama}`}
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

      <Modal
        open={form !== null}
        onClose={() => !sibuk && setForm(null)}
        title="Tambah Kelas"
        footer={
          <>
            <button type="button" className="tombol-garis" onClick={() => setForm(null)} disabled={sibuk}>
              Batal
            </button>
            <button type="button" className="tombol-ungu" onClick={simpan} disabled={sibuk}>
              {sibuk ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        {form && (
          <div className="space-y-5">
            <Bidang label="Kode Kelas" wajib hint="Dipakai sebagai nilai pada kolom Kelas data siswa.">
              <input className="kolom" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} />
            </Bidang>
            <Bidang label="Nama Kelas" wajib>
              <input className="kolom" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </Bidang>
            <Bidang label="Wali Kelas">
              <input className="kolom" value={form.wali} onChange={(e) => setForm({ ...form, wali: e.target.value })} />
            </Bidang>
          </div>
        )}
      </Modal>

      <Konfirmasi
        open={hapus !== null}
        onClose={() => !sibuk && setHapus(null)}
        onKonfirmasi={konfirmasiHapus}
        judul="Hapus Kelas"
        pesan={`Hapus kelas "${hapus?.nama}"? Data siswa yang memakai kelas ini tidak ikut terhapus.`}
        labelKonfirmasi="Ya, Hapus"
        sibuk={sibuk}
      />
    </div>
  )
}