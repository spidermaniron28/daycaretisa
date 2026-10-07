'use client'

import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Konfirmasi } from '@/components/ui/modal'
import { Bidang, Kosong } from '@/components/ui/primitives'
import { SANDI_AWAL } from '@/lib/constants'
import { inisial, nipGuruBerikutnya, bandingkanNipGuru, labelKelas } from '@/lib/utils'
import type { Guru, Rombel } from '@/lib/types'

type FormState = {
  nip: string
  nipLama: string
  nama: string
  mapel: string
  nohp: string
  email: string
  /** Hanya dipakai saat menambah — akun login dibuat sekalian. */
  akunUsername: string
  akunPassword: string
}

const KOSONG: FormState = {
  nip: '',
  nipLama: '',
  nama: '',
  mapel: '',
  nohp: '',
  email: '',
  akunUsername: '',
  akunPassword: '',
}

export function TabelGuru({ awal, rombel }: { awal: Guru[]; rombel: Rombel[] }) {
  const [data, setData] = useState(awal)
  const [cari, setCari] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [hapus, setHapus] = useState<Guru | null>(null)
  const [sibuk, setSibuk] = useState(false)

  // Selalu tampil urut NIP (GURU-1, GURU-2, ...) supaya penomoran otomatis
  // terlihat rapi walau ada nomor lama yang baru terpakai kembali.
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase()
    const hasil = q
      ? data.filter((g) => [g.nip, g.nama, g.mapel, g.nohp].some((v) => v.toLowerCase().includes(q)))
      : [...data]
    return hasil.sort((a, b) => bandingkanNipGuru(a.nip, b.nip))
  }, [data, cari])

  async function muatUlang() {
    const terbaru = await fetch('/api/guru').then((r) => r.json())
    if (Array.isArray(terbaru)) setData(terbaru)
  }

  /** Buka form tambah dengan NIP otomatis: nomor terkecil yang masih kosong. */
  function tambah() {
    setForm({ ...KOSONG, nip: nipGuruBerikutnya(data.map((g) => g.nip)) })
  }

  async function simpan() {
    if (!form) return
    if (!form.nama.trim()) {
      toast.error('Nama wajib diisi.')
      return
    }
    setSibuk(true)
    try {
      const res = await fetch(form.nipLama ? `/api/guru/${encodeURIComponent(form.nipLama)}` : '/api/guru', {
        method: form.nipLama ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menyimpan data guru.')
        return
      }
      if (form.nipLama) {
        toast.success('Data guru diperbarui.')
      } else if (json.akun?.dibuat) {
        toast.success(
          `Guru ${json.nip} ditambahkan. Akun login: ${json.akun.username}` +
            (json.akun.sandiAwal ? ` / ${json.akun.sandiAwal}` : ' (sandi pilihan Anda).'),
        )
      } else {
        toast.success(
          `Guru ${json.nip} ditambahkan, tapi akun login tidak dibuat: ` +
            `${json.akun?.alasan ?? 'alasan tidak diketahui'}.`,
        )
      }
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
      const res = await fetch(`/api/guru/${encodeURIComponent(hapus.nip)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menghapus data.')
        return
      }
      toast.success('Data guru berhasil dihapus.')
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <h2 className="font-bold text-[15px] text-gray-800 shrink-0">
            Daftar Guru ({data.length})
          </h2>
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama, NIP, kelas..."
              className="kolom pl-9 py-2 text-[13px]"
            />
          </div>
        </div>

        <button type="button" onClick={tambah} className="tombol-hijau w-full md:w-auto">
          <Plus className="w-4 h-4" />
          Tambah Guru
        </button>
      </div>

      {tersaring.length === 0 ? (
        <Kosong
          judul={data.length === 0 ? 'Belum ada data guru' : 'Tidak ada hasil yang cocok'}
          pesan={data.length === 0 ? 'Tambahkan guru untuk mulai mencatat laporan harian.' : undefined}
        />
      ) : (
        <>
          {/* Mobile: kartu per guru */}
          <ul className="md:hidden divide-y divide-gray-100">
            {tersaring.map((g, i) => (
              <li key={g.nip} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-[12px] text-gray-400 tabular-nums pt-0.5 w-6 shrink-0">{i + 1}</span>
                  {g.foto ? (
                    <img src={g.foto} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-200" />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-[12px] shrink-0">
                      {inisial(g.nama)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-gray-800 truncate">{g.nama}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">{g.nip}</p>
                  </div>
                  {g.mapel && (
                    <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-md text-[11px] font-medium shrink-0">
                      {g.mapel}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 pl-9">
                  <div className="text-[12px] text-gray-500 truncate min-w-0">
                    {g.nohp && <span>{g.nohp}</span>}
                    {g.email && <span className="block truncate">{g.email}</span>}
                    {!g.nohp && !g.email && <span className="text-gray-300">Tidak ada kontak</span>}
                  </div>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          nip: g.nip,
                          nipLama: g.nip,
                          nama: g.nama,
                          mapel: g.mapel,
                          nohp: g.nohp,
                          email: g.email,
                          akunUsername: '',
                          akunPassword: '',
                        })
                      }
                      aria-label={`Ubah ${g.nama}`}
                      title="Ubah"
                      className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-600 px-2.5 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => setHapus(g)}
                      aria-label={`Hapus ${g.nama}`}
                      title="Hapus"
                      className="text-[11px] bg-red-50 hover:bg-red-100 text-red-500 px-2.5 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Hapus
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop/md+: tabel thead asli */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="cetak-sembunyi">
                <tr className="bg-gray-50 border-b border-gray-100 text-[13px] font-semibold text-gray-500">
                  <th scope="col" className="px-6 py-3 text-left font-semibold w-[56px]">No</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold w-[110px]">NIP</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Nama Guru</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold w-[160px]">Kelas</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold w-[180px]">Kontak</th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold w-[80px]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tersaring.map((g, i) => (
                  <tr key={g.nip} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4 text-[13px] text-gray-400 tabular-nums align-middle">{i + 1}</td>
                    <td className="px-4 py-4 text-[13px] font-medium text-gray-700 align-middle">{g.nip}</td>
                    <td className="px-4 py-4 align-middle">
                      <span className="flex items-center gap-3 min-w-0">
                        {g.foto ? (
                          <img src={g.foto} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-gray-200" />
                        ) : (
                          <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-[11px] shrink-0">
                            {inisial(g.nama)}
                          </span>
                        )}
                        <span className="text-[13px] text-gray-800 font-semibold truncate">{g.nama}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[13px] truncate align-middle">
                      {g.mapel || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-4 truncate text-[12px] align-middle">
                      {g.nohp || <span className="text-gray-300">—</span>}
                      {g.email && <span className="block text-gray-400 truncate">{g.email}</span>}
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <span className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              nip: g.nip,
                              nipLama: g.nip,
                              nama: g.nama,
                              mapel: g.mapel,
                              nohp: g.nohp,
                              email: g.email,
                              akunUsername: '',
                              akunPassword: '',
                            })
                          }
                          aria-label={`Ubah ${g.nama}`}
                          className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-600 px-2 py-1.5 rounded-md font-medium transition-colors inline-flex items-center"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setHapus(g)}
                          aria-label={`Hapus ${g.nama}`}
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
        title={form?.nipLama ? 'Ubah Data Guru' : 'Tambah Guru Baru'}
        footer={
          <>
            <button type="button" className="tombol-garis" onClick={() => setForm(null)} disabled={sibuk}>
              Batal
            </button>
            <button type="button" className="tombol-hijau" onClick={simpan} disabled={sibuk}>
              {sibuk ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Bidang
              label="NIP"
              wajib
              hint="Dibuat otomatis & berurutan. Nomor yang sudah dihapus akan dipakai lagi."
            >
              <input
                className="kolom bg-gray-50 text-gray-500 cursor-not-allowed"
                value={form.nip}
                readOnly
                aria-readonly="true"
                title="NIP dibuat otomatis oleh sistem"
              />
            </Bidang>
            <Bidang label="Nama Guru" wajib>
              <input className="kolom" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </Bidang>
            <Bidang label="Kelas" hint="Pilih kelas yang sudah terdaftar di menu Rombel.">
              <select
                className="kolom"
                value={form.mapel}
                onChange={(e) => setForm({ ...form, mapel: e.target.value })}
              >
                <option value="">-- Pilih Kelas --</option>
                {rombel.map((r) => (
                  <option key={r.kode} value={r.kode}>
                    {labelKelas(r.kode, r.nama)}
                  </option>
                ))}
                {/* Nilai lama yang tidak ada di daftar rombel tetap ditampilkan
                    supaya data guru yang sudah tersimpan tidak hilang/berubah. */}
                {form.mapel && !rombel.some((r) => r.kode === form.mapel) && (
                  <option value={form.mapel}>{form.mapel}</option>
                )}
              </select>
            </Bidang>
            <Bidang label="No HP">
              <input className="kolom" value={form.nohp} inputMode="tel" onChange={(e) => setForm({ ...form, nohp: e.target.value })} />
            </Bidang>
            <Bidang label="Email" hint="Dipakai sebagai CC notifikasi ke wali kelas." className="md:col-span-2">
              <input
                type="email"
                className="kolom"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Bidang>

            {/* Akun login dibuat sekali saat penambahan; saat mengubah data
                guru, akun yang ada tidak ikut berubah. */}
            {!form.nipLama && (
              <>
                <div className="md:col-span-2 flex items-center gap-2 pt-2 border-t border-gray-100">
                  <UserPlus className="w-4 h-4 text-green-600 shrink-0" />
                  <p className="text-[13px] font-semibold text-gray-700">Akun Login</p>
                </div>

                <Bidang label="Username" hint={`Kosongkan untuk memakai NIP (${form.nip}).`}>
                  <input
                    className="kolom"
                    value={form.akunUsername}
                    onChange={(e) => setForm({ ...form, akunUsername: e.target.value })}
                    placeholder={form.nip}
                    autoComplete="off"
                  />
                </Bidang>

                <Bidang
                  label="Kata Sandi"
                  hint={`Kosongkan untuk memakai sandi awal ${SANDI_AWAL.guru}.`}
                >
                  <input
                    type="password"
                    className="kolom"
                    value={form.akunPassword}
                    onChange={(e) => setForm({ ...form, akunPassword: e.target.value })}
                    placeholder="Minimal 8 karakter"
                    autoComplete="new-password"
                  />
                </Bidang>

                <p className="md:col-span-2 text-[12px] text-gray-500 -mt-2">
                  Akun ini langsung muncul di menu Akun Pengguna dan bisa diubah di sana.
                </p>
              </>
            )}
          </div>
        )}
      </Modal>

      <Konfirmasi
        open={hapus !== null}
        onClose={() => !sibuk && setHapus(null)}
        onKonfirmasi={konfirmasiHapus}
        judul="Hapus Data Guru"
        pesan={`Hapus data "${hapus?.nama}"? Laporan yang pernah dibuat guru ini tetap tersimpan di spreadsheet.`}
        labelKonfirmasi="Ya, Hapus"
        sibuk={sibuk}
      />
    </div>
  )
}