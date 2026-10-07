'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Upload,
  Copy,
  ShieldCheck,
  Database,
  HardDrive,
  Check,
  ExternalLink,
  Link2,
  ChevronDown,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { HasilUjiTulis, StatusKoneksi } from '@/lib/types'

/* ---------------------------------------------------------------------------
 * Panel Status Koneksi Google.
 *
 * Menjawab pertanyaan yang paling sering muncul: "kenapa foto tidak bisa
 * diunggah?" — apakah putusnya di Sheets (Service Account) atau di Drive
 * (refresh token OAuth), dan apa yang harus dilakukan.
 * ------------------------------------------------------------------------- */

export function KartuKoneksi({
  awal,
  redirectUri,
}: {
  awal: StatusKoneksi
  /** Dihitung server dari header request, mis. http://localhost:3000/api/oauth/callback. */
  redirectUri: string
}) {
  const [status, setStatus] = useState<StatusKoneksi>(awal)
  const [uji, setUji] = useState<HasilUjiTulis | null>(null)
  const [sibukPeriksa, setSibukPeriksa] = useState(false)
  const [sibukUji, setSibukUji] = useState(false)
  const [sibukTandai, setSibukTandai] = useState(false)
  const [sibukHubung, setSibukHubung] = useState(false)
  /** Tautan izin cadangan bila browser memblokir popup. */
  const [tautanIzin, setTautanIzin] = useState('')
  /** Blok alamat izin Google dilipat — hanya perlu sekali saat pemasangan. */
  const [bukaAlamat, setBukaAlamat] = useState(false)

  async function periksaUlang() {
    setSibukPeriksa(true)
    try {
      const res = await fetch('/api/kesehatan?paksa=1')
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal memeriksa koneksi.')
        return
      }
      setStatus(json)
      toast.success(json.drive?.ok && json.sheets?.ok ? 'Kedua koneksi sehat.' : 'Ada koneksi yang bermasalah.')
    } catch {
      toast.error('Gagal menghubungi server.')
    } finally {
      setSibukPeriksa(false)
    }
  }

  async function ujiUnggah() {
    setSibukUji(true)
    try {
      const res = await fetch('/api/kesehatan', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menguji unggah.')
        return
      }
      setUji(json.uji)
      setStatus(json.status)
      if (json.uji?.ok) {
        toast.success('Uji unggah berhasil — foto siap dikirim ke Drive.')
      } else {
        toast.error('Uji unggah gagal. Lihat rinciannya di panel.')
      }
    } catch {
      toast.error('Gagal menghubungi server.')
    } finally {
      setSibukUji(false)
    }
  }

  /**
   * Buka layar izin Google lalu simpan token barunya.
   *
   * Dibuka di tab baru supaya aplikasi tetap terbuka; halaman callback akan
   * menutup dirinya sendiri setelah selesai.
   */
  async function hubungkanUlang() {
    setSibukHubung(true)
    try {
      const res = await fetch('/api/oauth/mulai', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal memulai proses hubungkan ulang.')
        return
      }
      // Jangan pernah memindahkan tab aplikasi ini: kalau browser memblokir
      // popup, tampilkan tautan agar admin bisa membukanya sendiri.
      const tab = window.open(json.url, '_blank')
      if (tab) {
        setTautanIzin('')
        toast.success('Setujui izin di tab Google, lalu klik Periksa Ulang di sini.')
      } else {
        setTautanIzin(json.url)
        toast.message('Tab baru diblokir. Klik "Buka layar izin Google" di bawah.')
      }
    } catch {
      toast.error('Gagal menghubungi server.')
    } finally {
      setSibukHubung(false)
    }
  }

  /** Catat bahwa app Google sudah dipublikasikan (In production). */
  async function ubahPublikasi(nilai: boolean) {
    setSibukTandai(true)
    try {
      const res = await fetch('/api/kesehatan/publikasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dipublikasikan: nilai }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Gagal menyimpan penanda publikasi.')
        return
      }
      setStatus(json.status)
      toast.success(
        nilai
          ? 'Ditandai permanen — peringatan 7 hari tidak akan muncul lagi.'
          : 'Penanda publikasi dilepas.',
      )
    } catch {
      toast.error('Gagal menghubungi server.')
    } finally {
      setSibukTandai(false)
    }
  }

  const adaMasalah = !status.sheets.ok || !status.drive.ok

  return (
    <section className="kartu p-6 md:p-8">
      <div className="flex items-start gap-4 mb-6">
        <span className="p-3 bg-emerald-50 rounded-lg text-emerald-500">
          <ShieldCheck className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-800">Status Koneksi Google</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Data disimpan di Google Spreadsheet dan foto di Google Drive.
          </p>
        </div>
      </div>

      {/* -------------------------- Dua baris status -------------------------- */}
      <div className="space-y-3">
        <BarisStatus
          ikon={<Database className="w-4 h-4" />}
          judul="Spreadsheet (data siswa, guru, laporan)"
          ok={status.sheets.ok}
          keterangan={status.sheets.ok ? 'Token Service Account diperbarui otomatis — tidak perlu diurus.' : undefined}
          pesan={status.sheets.pesan}
        />

        <BarisStatus
          ikon={<HardDrive className="w-4 h-4" />}
          judul="Google Drive (unggah foto profil & foto kegiatan)"
          ok={status.drive.ok}
          keterangan={
            status.drive.ok
              ? `${status.drive.akun || 'akun pemilik'} · access token diperbarui otomatis`
              : undefined
          }
          pesan={status.drive.pesan}
          tambahan={
            status.drive.umurTokenHari !== null
              ? `Refresh token dibuat ${status.drive.umurTokenHari} hari lalu`
              : undefined
          }
        />
      </div>

      {/* ---------------------------- Tombol aksi ---------------------------- */}
      <div className="flex flex-col sm:flex-row gap-2 mt-5">
        <button type="button" onClick={periksaUlang} disabled={sibukPeriksa} className="tombol-garis">
          <RefreshCw className={cn('w-4 h-4', sibukPeriksa && 'animate-spin')} />
          {sibukPeriksa ? 'Memeriksa...' : 'Periksa Ulang'}
        </button>
        <button
          type="button"
          onClick={ujiUnggah}
          disabled={sibukUji}
          className="tombol bg-emerald-600 hover:bg-emerald-700"
        >
          <Upload className={cn('w-4 h-4', sibukUji && 'animate-spin')} />
          {sibukUji ? 'Menguji...' : 'Uji Unggah Foto'}
        </button>
        <button
          type="button"
          onClick={hubungkanUlang}
          disabled={sibukHubung}
          className={cn(
            'tombol',
            status.drive.ok ? 'bg-blue-800 hover:bg-blue-900' : 'bg-red-600 hover:bg-red-700',
          )}
        >
          <Link2 className={cn('w-4 h-4', sibukHubung && 'animate-spin')} />
          {sibukHubung ? 'Menyiapkan...' : 'Hubungkan Ulang Drive'}
        </button>
      </div>

      {/* Tautan cadangan bila popup diblokir browser. */}
      {tautanIzin && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[12px] text-amber-900">
          <p className="mb-2">Tab baru diblokir oleh browser. Buka layar izin lewat tautan ini:</p>
          <a
            href={tautanIzin}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-amber-900 underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka layar izin Google
          </a>
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-2">
        Uji unggah membuat berkas kecil di kedua folder Drive lalu langsung menghapusnya —
        tidak ada foto asli yang tersentuh.
      </p>

      {/* --------------------------- Hasil uji unggah -------------------------- */}
      {uji && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-[13px] font-semibold text-gray-700 mb-2">
            Hasil uji unggah {uji.ok ? '— berhasil' : '— gagal'}
          </p>
          <ul className="space-y-1.5 text-[12px]">
            {uji.rincian.map((r) => (
              <li key={r.folder} className="flex items-start gap-2">
                {r.tulis && r.hapus ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                )}
                <span className="text-gray-600">
                  <b className="text-gray-700">{r.folder}</b> — {r.pesan}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --------------------------- Bila bermasalah -------------------------- */}
      {adaMasalah && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="min-w-0 text-[13px] text-red-800">
              <p className="font-semibold">Ada koneksi yang perlu dihubungkan ulang.</p>
              {!status.drive.ok && (
                <>
                  <p className="mt-1">
                    Buka terminal di folder aplikasi, jalankan{' '}
                    <KodeTeks teks={status.perintahHubungkanUlang} /> lalu login dengan akun Google
                    pemilik folder foto dan setujui izinnya. Setelah itu klik{' '}
                    <b>Periksa Ulang</b>.
                  </p>
                  <ButtonSalin teks={status.perintahHubungkanUlang} />
                </>
              )}
              {!status.sheets.ok && (
                <p className="mt-1">
                  Periksa bahwa spreadsheet masih dibagikan ke email Service Account
                  (GOOGLE_SERVICE_ACCOUNT_EMAIL) dengan akses Editor, dan
                  GOOGLE_SPREADSHEET_ID sudah benar.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------- Permanen, atau masih berisiko 7 hari --------------- */}
      {status.drive.dipublikasikan ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-900">
          <p className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Koneksi Drive permanen
          </p>
          <p className="mt-1">
            App Google Anda sudah berstatus <b>&ldquo;In production&rdquo;</b>, jadi Google tidak
            lagi mencabut refresh token setiap 7 hari. Koneksi hanya perlu dihubungkan ulang bila
            Anda sendiri mencabut izinnya di myaccount.google.com/permissions, atau bila aplikasi
            tidak dipakai sama sekali lebih dari 6 bulan.
          </p>
        </div>
      ) : (
        <>
          {status.drive.ok && status.drive.mendekatiKedaluwarsa && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-amber-800">
                  Refresh token Drive sudah berumur lebih dari 5 hari. Karena app Google masih
                  berstatus <b>Testing</b>, Google akan mencabutnya di hari ke-7 (koneksi berubah
                  menjadi <b>PUTUS</b>). Kalau itu terjadi, cukup klik <b>Hubungkan Ulang Drive</b>{' '}
                  di atas — 30 detik, tanpa terminal.
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-[13px] text-blue-900">
            <p className="font-semibold">Mencari permanen? (opsional)</p>
            <p className="mt-1">
              Ada satu pengaturan di Google Cloud yang membuat token <b>tidak pernah</b> dicabut
              tiap 7 hari: mengubah status app dari <b>Testing</b> ke{' '}
              <b>&ldquo;In production&rdquo;</b> lewat tombol <b>Publish app</b>. Cari tombol itu
              di kartu <b>Publishing status</b> — di halaman <b>Audience</b>, di bawah daftar{' '}
              <i>Test users</i>.
            </p>
            <p className="mt-2 text-[12px] text-blue-800">
              <b>Kalau kartunya benar-benar tidak ada</b> (bukan karena belum di-scroll), itu bug
              Google yang sudah dilaporkan di issue tracker mereka dan beberapa proyek memang tidak
              mendapatkannya. Coba dulu tiga hal ini:
            </p>
            <ol className="list-decimal ml-5 mt-1 space-y-1 text-[12px] text-blue-800">
              <li>
                Lengkapi dulu halaman <b>Branding</b> (tautan ketiga di bawah): nama app, user
                support email, dan developer contact. Beberapa proyek tidak menampilkan tombol
                Publish app selama Branding belum lengkap — ini penyebab yang paling sering
                dilaporkan.
              </li>
              <li>
                Buka lewat <b>tampilan lama</b> OAuth consent screen (tautan kedua di bawah) —
                halaman ini punya tombol <b>PUBLISH APP</b> sendiri dan kadang masih tampil walau
                tampilan baru rusak.
              </li>
              <li>
                Buka Console di <b>jendela Incognito</b> atau browser lain <b>tanpa ekstensi</b> —
                pemblokir iklan/ekstensi berbagi-pakai skrip dapat menghapus kartu itu.
              </li>
              <li>Hitung ulang halaman (Ctrl+F5) dan pastikan Anda masuk sebagai pemilik proyek.</li>
            </ol>
            <p className="mt-2 text-[12px] text-blue-800">
              <b>Kalau tetap tidak ada, tidak apa-apa.</b> Panel ini sudah menyediakan tombol{' '}
              <b>Hubungkan Ulang Drive</b>, jadi pencabutan 7 hari hanya berarti satu klik 
              dan tidak ada data yang hilang.
            </p>
            <p className="mt-2 text-[12px] text-blue-800">
              <b>Verifikasi Google tidak diperlukan</b> walau app dipublikasikan: hanya SATU akun
              Google yang menyambung ke Drive (akun pemilik folder foto), sedangkan batas 100
              pengguna dihitung seumur hidup app. Peringatan &ldquo;app belum diverifikasi&rdquo;
              cukup dilewati dengan Advanced → Continue.
            </p>
            <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <a
                href="https://console.cloud.google.com/auth/audience?project=erapor-daycare"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-700 hover:text-blue-900"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Buka Audience
              </a>
              <a
                href="https://console.cloud.google.com/apis/credentials/consent?project=erapor-daycare"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-700 hover:text-blue-900"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Tampilan lama OAuth consent screen (tombol PUBLISH APP)
              </a>
              <a
                href="https://console.cloud.google.com/auth/branding?project=erapor-daycare"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-700 hover:text-blue-900"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Lengkapi Branding
              </a>
            </span>
          </div>
        </>
      )}

      {/* ------------------- Penanda sudah dipublikasikan ------------------- */}
      <button
        type="button"
        onClick={() => ubahPublikasi(!status.drive.dipublikasikan)}
        disabled={sibukTandai}
        className={cn(
          'mt-4 flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors',
          status.drive.dipublikasikan
            ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
            : 'border-gray-200 hover:bg-gray-50',
          sibukTandai && 'opacity-60',
        )}
      >
        <span
          className={cn(
            'mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0',
            status.drive.dipublikasikan
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-gray-300 bg-white',
          )}
        >
          {status.drive.dipublikasikan && <Check className="w-3.5 h-3.5" />}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-gray-800">
            App Google Drive sudah saya publikasikan (&ldquo;In production&rdquo;)
          </span>
          <span className="block text-[12px] text-gray-500 mt-0.5">
            {status.drive.dipublikasikan
              ? 'Peringatan 7 hari dimatikan. Klik untuk melepas penanda bila status di Console diubah kembali ke Testing.'
              : 'Centang setelah menekan “Publish app” di Google Cloud Console agar peringatan 7 hari tidak muncul lagi.'}
          </span>
        </span>
      </button>

      <p className="text-[11px] text-gray-400 mt-3">
        Terakhir diperiksa: {new Date(status.diperiksaPada).toLocaleString('id-ID')}
      </p>

      {/* ----------------------------------------------------------------------
        * Alamat izin Google — SENGAJA diletakkan paling bawah dan terlipat.
        *
        * Alamatnya hanya perlu didaftarkan SEKALI saat pemasangan, jadi tidak
        * perlu memakan ruang di antara tombol-tombol yang dipakai sehari-hari.
        * Bila tombol Hubungkan Ulang ditolak `redirect_uri_mismatch`, buka lipatan
        * ini untuk mengambil alamatnya.
        * -------------------------------------------------------------------- */}
      {redirectUri && (
        <div className="mt-5 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setBukaAlamat((buka) => !buka)}
            aria-expanded={bukaAlamat}
            className="flex w-full items-start gap-2 text-left text-[12px] text-gray-400 transition-colors hover:text-gray-700"
          >
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="flex-1">
              Alamat izin Google (didaftarkan sekali saja) — buka bila tombol Hubungkan Ulang
              ditolak <i>redirect_uri_mismatch</i>
            </span>
            <ChevronDown
              className={cn('w-4 h-4 shrink-0 transition-transform', bukaAlamat && 'rotate-180')}
            />
          </button>

          {bukaAlamat && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-[12px] text-gray-600">
              <p>
                Daftarkan alamat di bawah pada{' '}
                <b>Google Cloud → Clients → klien OAuth Anda → Authorized redirect URIs</b>. Tanpa
                ini Google menolak dengan <i>redirect_uri_mismatch</i>.
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-2">
                <code className="px-1.5 py-0.5 rounded bg-white border border-gray-200 font-mono break-all">
                  {redirectUri}
                </code>
                <ButtonSalin teks={redirectUri} halus />
              </p>
              <a
                href="https://console.cloud.google.com/auth/clients"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 font-medium text-gray-700 hover:text-gray-900"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Buka halaman Clients
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* ------------------------------ Potongan -------------------------------- */

function BarisStatus({
  ikon,
  judul,
  ok,
  keterangan,
  pesan,
  tambahan,
}: {
  ikon: React.ReactNode
  judul: string
  ok: boolean
  keterangan?: string
  pesan: string
  tambahan?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 p-4">
      <span
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
        )}
      >
        {ikon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-semibold text-gray-800">{judul}</p>
          <span
            className={cn(
              'text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full',
              ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
            )}
          >
            {ok ? 'TERHUBUNG' : 'PUTUS'}
          </span>
        </div>
        <p className="text-[12px] text-gray-500 mt-0.5">{keterangan ?? pesan}</p>
        {ok && pesan && <p className="text-[11px] text-gray-400 mt-0.5">{pesan}</p>}
        {tambahan && <p className="text-[11px] text-gray-400 mt-0.5">{tambahan}</p>}
      </div>
    </div>
  )
}

function KodeTeks({ teks }: { teks: string }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-white/70 border border-red-200 font-mono text-[12px]">
      {teks}
    </code>
  )
}

function ButtonSalin({ teks, halus }: { teks: string; halus?: boolean }) {
  const [tersalin, setTersalin] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(teks)
          setTersalin(true)
          setTimeout(() => setTersalin(false), 2000)
        } catch {
          toast.error('Gagal menyalin. Tulis perintahnya manual.')
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 text-[12px] font-medium',
        halus ? 'text-gray-600 hover:text-gray-900' : 'mt-2 text-red-700 hover:text-red-900',
      )}
    >
      <Copy className="w-3.5 h-3.5" />
      {tersalin ? 'Tersalin!' : halus ? 'Salin' : 'Salin perintah'}
    </button>
  )
}
