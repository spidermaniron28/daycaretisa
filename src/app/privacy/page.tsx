import type { Metadata } from 'next'

/* ---------------------------------------------------------------------------
 * Halaman publik — Kebijakan Privasi.
 *
 * Sengaja tidak membaca session maupun spreadsheet: halaman ini harus bisa
 * dibuka mesin (Google) tanpa cookie, karena Google memakainya untuk memeriksa
 * kelengkapan Branding sebelum tombol "Publish app" bisa diklik.
 * ------------------------------------------------------------------------- */

const KONTAK = 'spiderman.iron28@gmail.com'
const BERLAKU_SEJAK = '15 Oktober 2026'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi — E-Rapor Daycare',
  description: 'Bagaimana E-Rapor Daycare (Daycare Tisa) mengumpulkan, memakai, dan melindungi data anak, guru, dan orang tua.',
}

function Judul({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-2 text-[17px] font-semibold text-[#173661]">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 leading-relaxed text-gray-700">{children}</p>
}

function Daftar({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mb-3 list-disc space-y-1.5 pl-6 text-gray-700 leading-relaxed">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

export default function HalamanPrivasi() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[#173661]">Kebijakan Privasi</h1>
      <p className="mt-1 text-sm text-gray-500">
        E-Rapor Daycare · Daycare Tisa · Berlaku sejak {BERLAKU_SEJAK}
      </p>

      <P>
        Kebijakan ini menjelaskan bagaimana aplikasi E-Rapor Daycare mengumpulkan, menggunakan,
        dan melindungi informasi saat Anda — administrator, guru, maupun orang tua — menggunakan
        aplikasi ini, termasuk saat data laporan harian anak diisi dan dibuka.
      </P>

      <Judul>Informasi yang dikumpulkan</Judul>
      <Daftar
        items={[
          <>
            <strong>Akun pengguna:</strong> username, nama lengkap, dan peran (administrator, guru,
            atau orang tua). Kata sandi disimpan dalam bentuk ter-hash (scrypt) dan tidak pernah
            dikirim kembali ke browser.
          </>,
          <>
            <strong>Data anak:</strong> identitas anak (NIS, nama, kelas, jenis kelamin) serta
            laporan harian berupa kehadiran, pola makan, tidur, kondisi kesehatan, kebersihan,
            perkembangan, dan catatan pengasuh.
          </>,
          <>
            <strong>Foto kegiatan &amp; foto profil:</strong> diunggah melalui aplikasi dan
            disimpan di Google Drive pengelola daycare untuk ditampilkan pada laporan orang tua.
          </>,
          <>
            <strong>Kontak orang tua:</strong> email dan nomor WhatsApp (opsional) yang dipakai
            untuk keperluan komunikasi sekolah.
          </>,
          <>
            <strong>Data Google yang diakses:</strong> aplikasi memakai OAuth dengan scope{' '}
            <code className="rounded bg-gray-100 px-1 text-[13px]">drive.file</code>, yang hanya
            memberi akses ke berkas yang <em> dibuat atau dibuka oleh aplikasi ini</em> — bukan
            seluruh isi Google Drive Anda. Kredensial Google tidak pernah disimpan di browser.
          </>,
        ]}
      />

      <Judul>Cara informasi digunakan</Judul>
      <Daftar
        items={[
          'Menjalankan fitur aplikasi: input laporan harian, rekap perkembangan, export Excel, dan cetak PDF.',
          'Menampilkan laporan kepada orang tua masing-masing anak — setiap orang tua hanya melihat laporan anaknya sendiri.',
          'Menjaga keamanan akun serta mencegah penyalahgunaan.',
        ]}
      />

      <Judul>Penyimpanan dan keamanan</Judul>
      <Daftar
        items={[
          'Data utama disimpan pada Google Spreadsheet milik pengelola daycare; foto disimpan pada Google Drive.',
          'Aplikasi berjalan di Vercel dengan koneksi HTTPS.',
          'Sesi login memakai cookie httpOnly berlaku 8 jam, sehingga token tidak dapat dibaca dari JavaScript browser.',
          'Akses dibatasi sesuai peran: administrator, guru, dan orang tua.',
        ]}
      />

      <Judul>Pembagian data</Judul>
      <P>
        Kami tidak menjual, menyewakan, atau membagikan informasi pribadi anak dan keluarga kepada
        pihak ketiga untuk tujuan pemasaran. Data hanya diakses oleh pengelola daycare dan guru
        yang menangani anak tersebut, sejauh yang diperlukan untuk menjalankan layanan.
      </P>

      <Judul>Hak Anda</Judul>
      <Daftar
        items={[
          'Anda dapat mencabut akses aplikasi kapan saja melalui Google Account → Aplikasi & layanan pihak ketiga.',
          'Anda dapat meminta koreksi atau penghapusan data anak/akun dengan menghubungi pengelola daycare.',
        ]}
      />

      <Judul>Perubahan kebijakan</Judul>
      <P>
        Kebijakan ini dapat diperbarui sewaktu-waktu. Tanggal berlaku terbaru selalu tercantum di
        bagian atas halaman ini.
      </P>

      <Judul>Kontak</Judul>
      <P>
        Pertanyaan seputar privasi? Hubungi pengelola aplikasi:{' '}
        <a className="font-medium text-[#173661] underline" href={`mailto:${KONTAK}`}>
          {KONTAK}
        </a>
      </P>

      <footer className="mt-10 border-t border-gray-200 pt-4 text-sm text-gray-500">
        © {new Date().getFullYear()} Daycare Tisa — Kebijakan Privasi ini disediakan untuk tujuan
        transparansi penggunaan aplikasi dan akses Google Drive.
      </footer>
    </main>
  )
}
