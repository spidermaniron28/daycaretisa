'use client'

import { useMemo, useState } from 'react'
import { RefreshCw, Plus, Pencil, Trash2, Search, KeyRound, User, ShieldCheck, LogIn, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Konfirmasi } from '@/components/ui/modal'
import { Bidang, Kosong } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import type { Akun, Role } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Manajemen akun pengguna.
 *
 * PENTING: kolom password tidak pernah dikirim ke browser. Yang tampil hanya
 * status "Terproteksi" (sudah berupa hash) atau "Perlu Diperbarui" (masih
 * password lama dari aplikasi Apps Script). Aplikasi lama menampilkan password
 * polos apa adanya di tabel ini.
 * ------------------------------------------------------------------------- */

const WARNA_ROLE: Record<Role, string> = {
  admin: 'bg-red-100 text-red-600',
  guru: 'bg-green-100 text-green-600',
  siswa: 'bg-blue-100 text-blue-600',
}

/** Nama kolom "ID Asli" per peran — sekolah lebih paham istilah NIS/NIP. */
function labelId(role: Role): string {
  return role === 'siswa' ? 'NIS' : role === 'guru' ? 'NIP' : 'ID'
}

/** Portal yang dituju tiap peran saat login. */
const PORTAL: Record<Role, string> = {
  admin: 'Administrator',
  guru: 'Guru',
  siswa: 'Orang Tua/Siswa',
}

/**
 * NIS/NIP yang BISA dipakai untuk login. Login menerima kolom Username dan
 * kolom ID Asli, jadi keduanya ditampilkan supaya sekolah tidak salah
 * membagikan kredensial ke orang tua.
 */
function aliasLogin(a: Akun): string {
  return a.idAsli && a.idAsli !== a.username ? a.idAsli : ''
}

type Dialog =
  | { jenis: 'tambah' }
  | { jenis: 'sandi'; akun: Akun }
  | { jenis: 'username'; akun: Akun }
  | { jenis: 'nama'; akun: Akun }
  | { jenis: 'info'; akun: Akun }
  | { jenis: 'hapus'; akun: Akun }
  | null

export function TabelAkun({ awal, usernameSendiri }: { awal: Akun[]; usernameSendiri: string }) {
  const [data, setData] = useState(awal)
  const [cari, setCari] = useState('')
  const [filterRole, setFilterRole] = useState<Role | 'semua'>('semua')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [sibuk, setSibuk] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'siswa' as Role, nama: '' })

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return data.filter((a) => {
      if (filterRole !== 'semua' && a.role !== filterRole) return false
      if (!q) return true
      return [a.username, a.namaLengkap, a.idAsli].some((v) => v.toLowerCase().includes(q))
    })
  }, [data, cari, filterRole])

  async function muatUlang() {
    const terbaru = await fetch('/api/akun').then((r) => r.json())
    if (Array.isArray(terbaru)) setData(terbaru)
  }

  /** Satu pintu untuk semua aksi akun. */
  async function kirimAksi(body: Record<string, unknown>) {
    setSibuk(true)
    try {
      const res = await fetch('/api/akun', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal memproses permintaan.')
        return false
      }
      await muatUlang()
      return true
    } catch {
      toast.error('Gagal terhubung ke server.')
      return false
    } finally {
      setSibuk(false)
    }
  }

  async function tambahManual() {
    if (!form.username.trim() || !form.password) {
      toast.error('Username dan kata sandi wajib diisi.')
      return
    }
    setSibuk(true)
    try {
      const res = await fetch('/api/akun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menambah akun.')
        return
      }
      toast.success('Akun baru berhasil ditambahkan.')
      setDialog(null)
      setForm({ username: '', password: '', role: 'siswa', nama: '' })
      await muatUlang()
    } catch {
      toast.error('Gagal terhubung ke server.')
    } finally {
      setSibuk(false)
    }
  }

  async function generate(role: 'guru' | 'siswa') {
    const ok = await kirimAksi({ aksi: 'generate', role, username: '' })
    if (ok) toast.success('Akun berhasil dibuat. Kata sandi awal bisa langsung diubah guru/ortu.')
  }

  const belumHash = data.filter((a) => !a.passwordTerhash).length

  /** Akun yang sedang acted upon (bukan dialog tambah/generate). */
  const akunAktif = dialog && dialog.jenis !== 'tambah' ? dialog.akun : null

  return (
    <div className="space-y-5">
      {belumHash > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-[13px]">
          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{belumHash} akun masih memakai password lama.</p>
            <p className="mt-0.5">
              Password lama akan otomatis diamankan (di-hash) saat pengguna tersebut login
              pertama kali — tidak perlu ada tindakan manual.
            </p>
          </div>
        </div>
      )}

      <div className="kartu overflow-hidden">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 p-5 md:p-6 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <h2 className="font-bold text-[15px] text-gray-800 shrink-0">
              Daftar Akun ({tersaring.length}/{data.length})
            </h2>
            <div className="relative flex-1 min-w-[180px] xl:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari username, NIS/NIP, atau nama..."
                className="kolom pl-9 py-2 text-[13px]"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as Role | 'semua')}
              className="kolom py-2 text-[13px] w-auto"
              aria-label="Saring berdasarkan peran"
            >
              <option value="semua">Semua Peran</option>
              <option value="admin">Administrator</option>
              <option value="guru">Guru</option>
              <option value="siswa">Orang Tua/Siswa</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
            <button
              type="button"
              onClick={() => generate('guru')}
              disabled={sibuk}
              className="tombol-hijau flex-1"
            >
              <RefreshCw className="w-4 h-4" />
              Generate Akun Guru
            </button>
            <button
              type="button"
              onClick={() => generate('siswa')}
              disabled={sibuk}
              className="tombol-biru flex-1"
            >
              <RefreshCw className="w-4 h-4" />
              Generate Akun Siswa
            </button>
            <button
              type="button"
              onClick={() => setDialog({ jenis: 'tambah' })}
              className="tombol-amber flex-1"
            >
              <Plus className="w-4 h-4" />
              Tambah Akun
            </button>
          </div>
        </div>

        {tersaring.length === 0 ? (
          <Kosong judul="Tidak ada akun yang cocok" />
        ) : (
          <>
            {/* Mobile: kartu per akun */}
            <ul className="md:hidden divide-y divide-gray-100">
              {tersaring.map((a, i) => (
                <li key={`${a.role}-${a.username}`} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-[12px] text-gray-400 tabular-nums pt-0.5 w-6 shrink-0">{i + 1}</span>
                    <span
                      className={cn(
                        'px-2 py-1 rounded-full text-[10px] font-bold tracking-wider shrink-0',
                        WARNA_ROLE[a.role],
                      )}
                    >
                      {a.role.toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-gray-800 truncate">{a.username}</p>
                      <p className="text-[12px] text-gray-500 mt-0.5 truncate">
                        {a.namaLengkap || 'Nama belum diisi'}
                      </p>
                      {/* Satu baris saja: NIS/NIP yang bisa dipakai login bila
                          berbeda dari username, atau ID-nya bila sudah sama. */}
                      {aliasLogin(a) ? (
                        <p className="text-[11px] text-indigo-600 mt-0.5 truncate">
                          Bisa masuk dengan {labelId(a.role)} {aliasLogin(a)} juga
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                          {labelId(a.role)}: {a.idAsli || '—'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-9">
                    <div className="flex items-center gap-2 min-w-0">
                      {a.passwordTerhash ? (
                        <span title="Password tersimpan sebagai hash" className="inline-flex items-center gap-1 text-[11px] text-green-600">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Terproteksi</span>
                        </span>
                      ) : (
                        <span title="Masih password lama — akan otomatis diamankan saat login berikutnya" className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Perlu Diperbarui</span>
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <TombolIkon
                        label={`Info login ${a.username}`}
                        onClick={() => setDialog({ jenis: 'info', akun: a })}
                        warna="bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
                      >
                        <LogIn className="w-3 h-3" />
                      </TombolIkon>
                      <TombolIkon
                        label={`Ubah kata sandi ${a.username}`}
                        onClick={() => setDialog({ jenis: 'sandi', akun: a })}
                        warna="bg-blue-50 hover:bg-blue-100 text-blue-600"
                      >
                        <KeyRound className="w-3 h-3" />
                      </TombolIkon>
                      <TombolIkon
                        label={`Ubah nama ${a.username}`}
                        onClick={() => setDialog({ jenis: 'nama', akun: a })}
                        warna="bg-amber-50 hover:bg-amber-100 text-amber-600"
                      >
                        <User className="w-3 h-3" />
                      </TombolIkon>
                      <TombolIkon
                        label={`Ubah username ${a.username}`}
                        onClick={() => setDialog({ jenis: 'username', akun: a })}
                        warna="bg-gray-50 hover:bg-gray-100 text-gray-600"
                      >
                        <Pencil className="w-3 h-3" />
                      </TombolIkon>
                      <TombolIkon
                        label={`Hapus akun ${a.username}`}
                        onClick={() => setDialog({ jenis: 'hapus', akun: a })}
                        warna="bg-red-50 hover:bg-red-100 text-red-500"
                        nonaktif={a.username === usernameSendiri}
                      >
                        <Trash2 className="w-3 h-3" />
                      </TombolIkon>
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop/md+: tabel thead asli */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[13px] font-semibold text-gray-500">
                    <th scope="col" className="px-6 py-3 text-left font-semibold w-[56px]">No</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold w-[100px]">Peran</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold w-[200px]">Username</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold w-[110px]">
                      NIS / NIP
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Nama</th>
                    <th scope="col" className="px-4 py-3 text-center font-semibold w-[120px]">Sandi</th>
                    <th scope="col" className="px-6 py-3 text-right font-semibold w-[160px]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tersaring.map((a, i) => (
                    <tr key={`${a.role}-${a.username}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 text-[13px] text-gray-400 tabular-nums align-middle">{i + 1}</td>
                      <td className="px-4 py-4 align-middle">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-[10px] font-bold tracking-wider',
                            WARNA_ROLE[a.role],
                          )}
                        >
                          {a.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <p className="text-[13px] text-gray-800 font-medium">{a.username}</p>
                        {aliasLogin(a) && (
                          <p className="text-[11px] text-indigo-600 mt-0.5">
                            Bisa masuk juga dengan {labelId(a.role)}: {aliasLogin(a)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-[12px] text-gray-500 align-middle">
                        {a.idAsli || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-[13px] truncate align-middle" title={a.namaLengkap}>
                        {a.namaLengkap || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-4 text-center align-middle">
                        {a.passwordTerhash ? (
                          <span
                            title="Password tersimpan sebagai hash"
                            className="inline-flex items-center gap-1 text-[11px] text-green-600"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Terproteksi</span>
                          </span>
                        ) : (
                          <span
                            title="Masih password lama — akan otomatis diamankan saat login berikutnya"
                            className="inline-flex items-center gap-1 text-[11px] text-amber-600"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Perlu Diperbarui</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span className="flex items-center justify-end gap-1.5">
                          <TombolIkon
                            label={`Info login ${a.username}`}
                            onClick={() => setDialog({ jenis: 'info', akun: a })}
                            warna="bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
                          >
                            <LogIn className="w-3 h-3" />
                          </TombolIkon>
                          <TombolIkon
                            label={`Ubah kata sandi ${a.username}`}
                            onClick={() => setDialog({ jenis: 'sandi', akun: a })}
                            warna="bg-blue-50 hover:bg-blue-100 text-blue-600"
                          >
                            <KeyRound className="w-3 h-3" />
                          </TombolIkon>
                          <TombolIkon
                            label={`Ubah nama ${a.username}`}
                            onClick={() => setDialog({ jenis: 'nama', akun: a })}
                            warna="bg-amber-50 hover:bg-amber-100 text-amber-600"
                          >
                            <User className="w-3 h-3" />
                          </TombolIkon>
                          <TombolIkon
                            label={`Ubah username ${a.username}`}
                            onClick={() => setDialog({ jenis: 'username', akun: a })}
                            warna="bg-gray-50 hover:bg-gray-100 text-gray-600"
                          >
                            <Pencil className="w-3 h-3" />
                          </TombolIkon>
                          <TombolIkon
                            label={`Hapus akun ${a.username}`}
                            onClick={() => setDialog({ jenis: 'hapus', akun: a })}
                            warna="bg-red-50 hover:bg-red-100 text-red-500"
                            nonaktif={a.username === usernameSendiri}
                          >
                            <Trash2 className="w-3 h-3" />
                          </TombolIkon>
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

      {/* ----------------------------- Dialog --------------------------- */}
      <Modal
        open={dialog?.jenis === 'tambah'}
        onClose={() => setDialog(null)}
        title="Tambah Akun Manual"
        footer={
          <>
            <button type="button" className="tombol-garis" onClick={() => setDialog(null)} disabled={sibuk}>
              Batal
            </button>
            <button type="button" className="tombol-amber" onClick={tambahManual} disabled={sibuk}>
              {sibuk ? 'Menyimpan...' : 'Simpan Akun'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Bidang label="Peran">
            <select
              className="kolom"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="siswa">Orang Tua/Siswa</option>
              <option value="guru">Guru</option>
              <option value="admin">Administrator</option>
            </select>
          </Bidang>
          <Bidang label="Username" wajib>
            <input
              className="kolom"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </Bidang>
          <Bidang label="Kata Sandi" wajib hint="Minimal 8 karakter. Disimpan sebagai hash.">
            <input
              type="password"
              className="kolom"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
            />
          </Bidang>
          <Bidang label="Nama Lengkap">
            <input
              className="kolom"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="Opsional"
            />
          </Bidang>
        </div>
      </Modal>

      <DialogSandi
        akun={dialog?.jenis === 'sandi' ? dialog.akun : null}
        sibuk={sibuk}
        onTutup={() => setDialog(null)}
        onSimpan={async (pw) => {
          const ok = await kirimAksi({ aksi: 'reset-password', username: akunAktif!.username, passwordBaru: pw })
          if (ok) {
            toast.success(`Kata sandi ${akunAktif!.username} berhasil diperbarui.`)
            setDialog(null)
          }
        }}
      />

      <DialogUsername
        akun={dialog?.jenis === 'username' ? dialog.akun : null}
        sibuk={sibuk}
        onTutup={() => setDialog(null)}
        onSimpan={async (baru) => {
          const ok = await kirimAksi({ aksi: 'ubah-username', username: akunAktif!.username, usernameBaru: baru })
          if (ok) {
            toast.success('Username berhasil diperbarui. Nama & ID asli tetap dipertahankan.')
            setDialog(null)
          }
        }}
      />

      <DialogSederhana
        judul="Ubah Nama Akun"
        akun={dialog?.jenis === 'nama' ? dialog.akun : null}
        label="Nama Lengkap"
        sibuk={sibuk}
        onTutup={() => setDialog(null)}
        onSimpan={async (nama) => {
          const ok = await kirimAksi({ aksi: 'ubah-nama', username: akunAktif!.username, namaBaru: nama })
          if (ok) {
            toast.success('Nama berhasil diperbarui.')
            setDialog(null)
          }
        }}
      />

      <DialogInfoLogin
        akun={dialog?.jenis === 'info' ? dialog.akun : null}
        onTutup={() => setDialog(null)}
      />

      <Konfirmasi
        open={dialog?.jenis === 'hapus'}
        onClose={() => setDialog(null)}
        onKonfirmasi={async () => {
          const ok = await kirimAksi({ aksi: 'hapus', username: akunAktif!.username })
          if (ok) {
            toast.success('Akun berhasil dihapus.')
            setDialog(null)
          }
        }}
        judul="Hapus Akun"
        pesan={`Hapus akun "${akunAktif?.username ?? ''}"? Data siswa/guru di spreadsheet tidak ikut terhapus.`}
        labelKonfirmasi="Ya, Hapus"
        sibuk={sibuk}
      />
    </div>
  )
}

/* ------------------------------ Potongan -------------------------------- */

/**
 * Ringkasan kredensial satu akun, supaya sekolah bisa menyalin dan mengirimkan
 * informasi login yang benar ke orang tua (username ATAU NIS keduanya sah).
 */
function DialogInfoLogin({ akun, onTutup }: { akun: Akun | null; onTutup: () => void }) {
  const [tersalin, setTersalin] = useState(false)

  const alias = akun ? aliasLogin(akun) : ''
  const ringkas = akun
    ? [
        `Portal ${PORTAL[akun.role]}`,
        `Username: ${akun.username}`,
        alias ? `${labelId(akun.role)} (juga bisa dipakai): ${alias}` : '',
        `Nama: ${akun.namaLengkap || '-'}`,
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  async function salin() {
    try {
      await navigator.clipboard.writeText(ringkas)
      setTersalin(true)
      setTimeout(() => setTersalin(false), 2000)
    } catch {
      toast.error('Gagal menyalin otomatis. Salin manual dari kotak di atas.')
    }
  }

  return (
    <Modal
      open={akun !== null}
      onClose={onTutup}
      title="Informasi Login"
      deskripsi={akun ? `Akun: ${akun.username}` : undefined}
      lebar="sm"
      footer={
        <>
          <button type="button" className="tombol-garis" onClick={onTutup}>
            Tutup
          </button>
          <button type="button" className="tombol-biru" onClick={salin}>
            <Copy className="w-4 h-4" />
            {tersalin ? 'Tersalin!' : 'Salin Info'}
          </button>
        </>
      }
    >
      {akun && (
        <div className="space-y-4">
          <dl className="space-y-3 text-[13px]">
            <BarisInfo label="Portal" nilai={PORTAL[akun.role]} />
            <BarisInfo label="Username" nilai={akun.username} mono />
            <BarisInfo label={labelId(akun.role)} nilai={akun.idAsli || '—'} mono />
            <BarisInfo label="Nama" nilai={akun.namaLengkap || '—'} />
            <BarisInfo
              label="Kata Sandi"
              nilai={
                akun.passwordTerhash
                  ? 'Tersimpan sebagai hash'
                  : 'Masih password lama — otomatis diamankan saat login'
              }
            />
          </dl>

          {akun.role === 'admin' ? (
            <p className="text-[12px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Akun administrator tidak terhubung ke data guru atau siswa.
            </p>
          ) : alias ? (
            <p className="text-[12px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              Untuk akun ini, kolom <b>Username</b> dan <b>{labelId(akun.role)}</b> sama-sama bisa
              dipakai di halaman login. Bagikan keduanya supaya orang tua tidak salah ketik.
            </p>
          ) : (
            <p className="text-[12px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Username akun ini sudah sama dengan {labelId(akun.role)}, jadi cukup satu saja yang
              dibagikan.
            </p>
          )}

          <p className="text-[12px] text-gray-400">
            Kata sandi tidak ditampilkan di sini karena tersimpan ter-hash. Pakai tombol kunci di
            tabel bila perlu mengatur ulang.
          </p>
        </div>
      )}
    </Modal>
  )
}

function BarisInfo({ label, nilai, mono }: { label: string; nilai: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className={cn('text-gray-800 font-medium text-right break-all', mono && 'font-mono')}>
        {nilai}
      </dd>
    </div>
  )
}

function TombolIkon({
  label,
  onClick,
  warna,
  children,
  nonaktif,
}: {
  label: string
  onClick: () => void
  warna: string
  children: React.ReactNode
  nonaktif?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={nonaktif}
      aria-label={label}
      title={nonaktif ? 'Tidak bisa menghapus akun sendiri' : label}
      className={cn(
        'w-7 h-7 rounded-md font-medium transition-colors inline-flex items-center justify-center',
        warna,
        nonaktif && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )
}

function DialogSandi({
  akun,
  sibuk,
  onTutup,
  onSimpan,
}: {
  akun: Akun | null
  sibuk: boolean
  onTutup: () => void
  onSimpan: (pw: string) => Promise<void>
}) {
  const [pw, setPw] = useState('')

  return (
    <Modal
      open={akun !== null}
      onClose={onTutup}
      title="Atur Ulang Kata Sandi"
      deskripsi={akun ? `Akun: ${akun.username} (${akun.namaLengkap})` : undefined}
      lebar="sm"
      footer={
        <>
          <button type="button" className="tombol-garis" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button
            type="button"
            className="tombol-biru"
            disabled={sibuk || pw.length < 8}
            onClick={async () => {
              await onSimpan(pw)
              setPw('')
            }}
          >
            {sibuk ? 'Menyimpan...' : 'Simpan'}
          </button>
        </>
      }
    >
      <Bidang label="Kata Sandi Baru" wajib hint="Minimal 8 karakter.">
        <input
          type="password"
          className="kolom"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="new-password"
        />
      </Bidang>
    </Modal>
  )
}

function DialogUsername({
  akun,
  sibuk,
  onTutup,
  onSimpan,
}: {
  akun: Akun | null
  sibuk: boolean
  onTutup: () => void
  onSimpan: (baru: string) => Promise<void>
}) {
  const [baru, setBaru] = useState('')

  return (
    <Modal
      open={akun !== null}
      onClose={onTutup}
      title="Ubah Username"
      deskripsi="Nama lengkap dan ID asli anak TIDAK ikut berubah."
      lebar="sm"
      footer={
        <>
          <button type="button" className="tombol-garis" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button
            type="button"
            className="tombol-biru"
            disabled={sibuk || !baru.trim()}
            onClick={async () => {
              await onSimpan(baru)
              setBaru('')
            }}
          >
            {sibuk ? 'Menyimpan...' : 'Simpan'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Bidang label="Username Lama">
          <input className="kolom bg-gray-50" value={akun?.username ?? ''} readOnly />
        </Bidang>
        <Bidang label="Username Baru" wajib>
          <input className="kolom" value={baru} onChange={(e) => setBaru(e.target.value)} />
        </Bidang>
      </div>
    </Modal>
  )
}

function DialogSederhana({
  judul,
  akun,
  label,
  sibuk,
  onTutup,
  onSimpan,
}: {
  judul: string
  akun: Akun | null
  label: string
  sibuk: boolean
  onTutup: () => void
  onSimpan: (nilai: string) => Promise<void>
}) {
  const [nilai, setNilai] = useState('')

  return (
    <Modal
      open={akun !== null}
      onClose={onTutup}
      title={judul}
      deskripsi={akun ? `Akun: ${akun.username}` : undefined}
      lebar="sm"
      footer={
        <>
          <button type="button" className="tombol-garis" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button
            type="button"
            className="tombol-biru"
            disabled={sibuk || !nilai.trim()}
            onClick={async () => {
              await onSimpan(nilai)
              setNilai('')
            }}
          >
            {sibuk ? 'Menyimpan...' : 'Simpan'}
          </button>
        </>
      }
    >
      <Bidang label={label} wajib>
        <input className="kolom" value={nilai} onChange={(e) => setNilai(e.target.value)} />
      </Bidang>
    </Modal>
  )
}