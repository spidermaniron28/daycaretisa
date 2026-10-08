'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Search, UserRound, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Konfirmasi } from '@/components/ui/modal'
import { Bidang, Kosong } from '@/components/ui/primitives'
import { SANDI_AWAL } from '@/lib/constants'
import { nisSiswaBerikutnya, bandingkanNisSiswa, labelKelas, usiaBulan, kelasDariUsia } from '@/lib/utils'
import type { Siswa, Rombel } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Tabel data siswa: cari, tambah, ubah, hapus.
 *
 * Nilai React escaping membuat XSS mustahil terjadi — di aplikasi lama nama
 * siswa disisipkan lewat innerHTML tanpa sanitasi.
 * ------------------------------------------------------------------------- */

interface Props {
  awal: Siswa[]
  rombel: Rombel[]
  /** Guru boleh menambah & mengubah data siswa di portalnya juga. */
  bolehUbah?: boolean
}

type FormState = {
  nis: string
  nisLama: string
  nama: string
  kelas: string
  jk: 'L' | 'P'
  status: 'Aktif' | 'Nonaktif'
  emailOrtu: string
  noWhatsapp: string
  /** YYYY-MM-DD — dipakai hitung usia anak untuk interpretasi BB/TB. */
  tanggalLahir: string
  /** Hanya dipakai saat menambah — akun login dibuat sekalian. */
  akunUsername: string
  akunPassword: string
}

const KOSONG_FORM: FormState = {
  nis: '',
  nisLama: '',
  nama: '',
  kelas: '',
  jk: 'L',
  status: 'Aktif',
  emailOrtu: '',
  noWhatsapp: '',
  tanggalLahir: '',
  akunUsername: '',
  akunPassword: '',
}

export function TabelSiswa({ awal, rombel, bolehUbah = true }: Props) {
  const router = useRouter()
  const [data, setData] = useState<Siswa[]>(awal)
  const [cari, setCari] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [hapus, setHapus] = useState<Siswa | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [, mulaiTransisi] = useTransition()

  // Selalu tampil urut NIS (SISWA-1, SISWA-2, ...) supaya penomoran otomatis
  // terlihat rapi walau ada nomor lama yang baru terpakai kembali.
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase()
    const hasil = q
      ? data.filter((s) =>
          [s.nis, s.nama, s.kelas, s.status].some((v) => v.toLowerCase().includes(q)),
        )
      : [...data]
    return hasil.sort((a, b) => bandingkanNisSiswa(a.nis, b.nis))
  }, [data, cari])

  /** Usia (bulan) bila tanggal lahir sudah diisi — dipakai memilih kelas. */
  const usiaSiswa = form?.tanggalLahir ? usiaBulan(form.tanggalLahir) : null
  const kelasOtomatis = form?.tanggalLahir ? kelasDariUsia(form.tanggalLahir, rombel) : null

  function labelUntukKode(kode: string): string {
    const r = rombel.find((x) => x.kode === kode)
    return r ? labelKelas(r.kode, r.nama) : kode
  }

  /** Buka form tambah dengan NIS otomatis: nomor terkecil yang masih kosong. */
  function tambah() {
    setForm({
      ...KOSONG_FORM,
      kelas: rombel[0]?.kode ?? '',
      nis: nisSiswaBerikutnya(data.map((s) => s.nis)),
    })
  }

  function ubah(s: Siswa) {
    setForm({
      nis: s.nis,
      nisLama: s.nis,
      nama: s.nama,
      kelas: s.kelas,
      jk: s.jk === 'P' ? 'P' : 'L',
      status: s.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
      emailOrtu: s.emailOrtu,
      noWhatsapp: s.noWhatsapp,
      tanggalLahir: s.tanggalLahir,
      akunUsername: '',
      akunPassword: '',
    })
  }

  async function simpan() {
    if (!form) return
    if (!form.nis.trim() || !form.nama.trim() || !form.kelas.trim()) {
      toast.error('NIS, Nama, dan Kelas wajib diisi.')
      return
    }

    setSibuk(true)
    try {
      const url = form.nisLama
        ? `/api/siswa/${encodeURIComponent(form.nisLama)}`
        : '/api/siswa'
      const res = await fetch(url, {
        method: form.nisLama ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menyimpan data siswa.')
        return
      }

      if (form.nisLama) {
        toast.success('Data siswa berhasil diperbarui.')
      } else if (json.akun?.dibuat) {
        toast.success(
          `Siswa ${json.nis ?? form.nis} ditambahkan. Akun login: ${json.akun.username}` +
            (json.akun.sandiAwal ? ` / ${json.akun.sandiAwal}` : ' (sandi pilihan Anda).'),
        )
      } else {
        toast.success(
          `Siswa ${json.nis ?? form.nis} ditambahkan, tapi akun login tidak dibuat: ` +
            `${json.akun?.alasan ?? 'alasan tidak diketahui'}.`,
        )
      }
      setForm(null)
      mulaiTransisi(() => router.refresh())
      // Muat ulang daftar agar tampilan mencerminkan perubahan di server.
      const terbaru = await fetch('/api/siswa').then((r) => r.json())
      if (Array.isArray(terbaru)) setData(terbaru)
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
      const res = await fetch(`/api/siswa/${encodeURIComponent(hapus.nis)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menghapus data.')
        return
      }
      toast.success('Data siswa berhasil dihapus.')
      setHapus(null)
      setData((d) => d.filter((s) => s.nis !== hapus.nis))
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
            Daftar Siswa ({data.length})
          </h2>
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari NIS, nama, kelas..."
              className="kolom pl-9 py-2 text-[13px]"
            />
          </div>
        </div>

        {bolehUbah && (
          <button type="button" onClick={tambah} className="tombol-biru w-full md:w-auto">
            <Plus className="w-4 h-4" />
            Tambah Siswa
          </button>
        )}
      </div>

      {tersaring.length === 0 ? (
        <Kosong
          judul={data.length === 0 ? 'Belum ada data siswa' : 'Tidak ada hasil yang cocok'}
          pesan={
            data.length === 0
              ? 'Tambahkan siswa terlebih dahulu, atau isi langsung di spreadsheet.'
              : 'Coba kata kunci pencarian yang lain.'
          }
        />
      ) : (
        <>
          {/* Mobile: daftar kartu per siswa (tabel terasa sempit di layar kecil) */}
          <ul className="md:hidden divide-y divide-gray-100">
            {tersaring.map((s, i) => (
              <li key={s.nis} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-[12px] text-gray-400 tabular-nums pt-0.5 w-6 shrink-0">{i + 1}</span>
                  {s.foto ? (
                    <img
                      src={s.foto}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-200"
                    />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                      <UserRound className="w-4 h-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-gray-800 truncate">{s.nama}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">{s.nis}</p>
                  </div>
                  <span
                    className={
                      s.status === 'Aktif'
                        ? 'text-[11px] font-semibold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full shrink-0'
                        : 'text-[11px] font-semibold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full shrink-0'
                    }
                  >
                    {s.status}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 pl-9">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-md text-[11px] font-medium shrink-0">
                      {s.kelas}
                    </span>
                    <span className="text-[12px] text-gray-500 shrink-0">{s.jk}</span>
                  </div>
                  {bolehUbah && (
                    <span className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => ubah(s)}
                        aria-label={`Ubah ${s.nama}`}
                        title="Ubah"
                        className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-600 px-2.5 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => setHapus(s)}
                        aria-label={`Hapus ${s.nama}`}
                        title="Hapus"
                        className="text-[11px] bg-red-50 hover:bg-red-100 text-red-500 px-2.5 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Hapus
                      </button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop/md+: tabel dengan thead asli agar kolom header & isi sejajar */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[13px] font-semibold text-gray-500">
                  <th scope="col" className="px-6 py-3 text-left font-semibold w-[56px]">No</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold w-[120px]">NIS</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Nama Lengkap</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold w-[120px]">Kelas</th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold w-[64px]">L/P</th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold w-[100px]">Status</th>
                  {bolehUbah && (
                    <th scope="col" className="px-6 py-3 text-right font-semibold w-[100px]">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {tersaring.map((s, i) => (
                  <tr key={s.nis} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4 text-[13px] text-gray-400 tabular-nums align-middle">{i + 1}</td>
                    <td className="px-4 py-4 text-[13px] font-medium text-gray-700 align-middle">{s.nis}</td>
                    <td className="px-4 py-4 align-middle">
                      <span className="flex items-center gap-2.5 min-w-0">
                        {s.foto ? (
                          <img
                            src={s.foto}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover shrink-0 border border-gray-200"
                          />
                        ) : (
                          <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                            <UserRound className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span className="text-[13px] text-gray-800 font-semibold truncate">{s.nama}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <span className="inline-block bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-md text-[11px] font-medium">
                        {s.kelas}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-[13px] text-gray-500 align-middle">{s.jk}</td>
                    <td className="px-4 py-4 text-center align-middle">
                      <span
                        className={
                          s.status === 'Aktif'
                            ? 'text-[12px] font-semibold text-green-600'
                            : 'text-[12px] font-semibold text-red-500'
                        }
                      >
                        {s.status}
                      </span>
                    </td>
                    {bolehUbah && (
                      <td className="px-6 py-4 align-middle">
                        <span className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => ubah(s)}
                            aria-label={`Ubah ${s.nama}`}
                            title="Ubah"
                            className="w-8 h-8 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-md font-medium transition-colors inline-flex items-center justify-center"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span className="sr-only">Ubah</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setHapus(s)}
                            aria-label={`Hapus ${s.nama}`}
                            title="Hapus"
                            className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-500 rounded-md font-medium transition-colors inline-flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="sr-only">Hapus</span>
                          </button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --------------------------- Modal ---------------------------- */}
      <Modal
        open={form !== null}
        onClose={() => !sibuk && setForm(null)}
        title={form?.nisLama ? 'Ubah Data Siswa' : 'Tambah Siswa Baru'}
        deskripsi="NIS dibuat otomatis dan berurutan — nomor yang sudah dihapus akan dipakai lagi."
        lebar="lg"
        footer={
          <>
            <button type="button" className="tombol-garis" onClick={() => setForm(null)} disabled={sibuk}>
              Batal
            </button>
            <button type="button" className="tombol-biru" onClick={simpan} disabled={sibuk}>
              {sibuk ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Bidang
              label="NIS"
              wajib
              hint="Dibuat otomatis & berurutan. Nomor yang sudah dihapus akan dipakai lagi."
            >
              <input
                className="kolom bg-gray-50 text-gray-500 cursor-not-allowed"
                value={form.nis}
                readOnly
                aria-readonly="true"
                title="NIS dibuat otomatis oleh sistem"
              />
            </Bidang>

            <Bidang label="Nama Lengkap" wajib>
              <input
                className="kolom"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
              />
            </Bidang>

            <Bidang
              label="Kelas"
              wajib
              hint={
                kelasOtomatis
                  ? `Terisi otomatis dari Tanggal Lahir (usia ${kelasOtomatis.usia} bulan): ${labelUntukKode(kelasOtomatis.kode)}. Bisa diubah manual.`
                  : usiaSiswa !== null
                    ? `Usia ${usiaSiswa} bulan di luar rentang kelas yang tersedia — pilih kelas manual.`
                    : 'Pilih dari daftar Rombel. Isi Tanggal Lahir agar kelas terpilih otomatis.'
              }
            >
              <select
                className="kolom"
                value={form.kelas}
                onChange={(e) => setForm({ ...form, kelas: e.target.value })}
              >
                <option value="">-- Pilih Kelas --</option>
                {rombel.map((r) => (
                  <option key={r.kode} value={r.kode}>
                    {labelKelas(r.kode, r.nama)}
                  </option>
                ))}
              </select>
            </Bidang>

            <Bidang label="Jenis Kelamin">
              <select
                className="kolom"
                value={form.jk}
                onChange={(e) => setForm({ ...form, jk: e.target.value as 'L' | 'P' })}
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </Bidang>

            <Bidang label="Status">
              <select
                className="kolom"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'Aktif' | 'Nonaktif' })}
              >
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </Bidang>

            <Bidang label="Email Orang Tua" hint="Dipakai untuk notifikasi laporan harian.">
              <input
                type="email"
                className="kolom"
                value={form.emailOrtu}
                onChange={(e) => setForm({ ...form, emailOrtu: e.target.value })}
                placeholder="ortu@email.com"
              />
            </Bidang>

            <Bidang label="No WhatsApp Orang Tua" hint="Disiapkan untuk notifikasi WhatsApp nanti.">
              <input
                className="kolom"
                value={form.noWhatsapp}
                inputMode="tel"
                onChange={(e) => setForm({ ...form, noWhatsapp: e.target.value })}
                placeholder="0812xxxxxxx"
              />
            </Bidang>

            <Bidang
              label="Tanggal Lahir"
              hint="Menentukan kelas otomatis & menghitung interpretasi berat/tinggi badan (standar WHO)."
            >
              <input
                type="date"
                className="kolom"
                value={form.tanggalLahir}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  const tanggalLahir = e.target.value
                  const auto = kelasDariUsia(tanggalLahir, rombel)
                  // Kelas ikut menyesuaikan tanggal lahir; kelas lama dipertahankan
                  // bila usianya di luar rentang kelas yang ada.
                  setForm({ ...form, tanggalLahir, kelas: auto ? auto.kode : form.kelas })
                }}
              />
            </Bidang>

            {/* Akun login dibuat sekali saat penambahan; saat mengubah data
                siswa, akun yang ada tidak ikut berubah. */}
            {!form.nisLama && (
              <>
                <div className="md:col-span-2 flex items-center gap-2 pt-2 border-t border-gray-100">
                  <UserPlus className="w-4 h-4 text-blue-600 shrink-0" />
                  <p className="text-[13px] font-semibold text-gray-700">Akun Login</p>
                </div>

                <Bidang label="Username" hint="Kosongkan untuk memakai NIS sebagai username.">
                  <input
                    className="kolom"
                    value={form.akunUsername}
                    onChange={(e) => setForm({ ...form, akunUsername: e.target.value })}
                    placeholder={form.nis || 'Sama dengan NIS'}
                    autoComplete="off"
                  />
                </Bidang>

                <Bidang
                  label="Kata Sandi"
                  hint={`Kosongkan untuk memakai sandi awal ${SANDI_AWAL.siswa}.`}
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
        judul="Hapus Data Siswa"
        pesan={`Hapus data "${hapus?.nama}" (NIS ${hapus?.nis})? Laporan harian anak ini tetap tersimpan, tapi tidak akan muncul lagi di portal orang tua.`}
        labelKonfirmasi="Ya, Hapus"
        sibuk={sibuk}
      />
    </div>
  )
}