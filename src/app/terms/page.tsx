import type { Metadata } from 'next'

/* ---------------------------------------------------------------------------
 * Halaman publik — Syarat & Ketentuan.
 * Alasan yang sama dengan /privacy: harus bisa dibuka tanpa login karena Google
 * memeriksanya pada saat proses Branding / Publish app.
 * ------------------------------------------------------------------------- */

const KONTAK = 'spiderman.iron28@gmail.com'
const BERLAKU_SEJAK = '15 Oktober 2026'

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan — E-Rapor Daycare',
  description: 'Syarat penggunaan aplikasi E-Rapor Daycare (Daycare Tisa) oleh administrator, guru, dan orang tua.',
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

export default function HalamanSyarat() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[#173661]">Syarat &amp; Ketentuan</h1>
      <p className="mt-1 text-sm text-gray-500">
        E-Rapor Daycare · Daycare Tisa · Berlaku sejak {BERLAKU_SEJAK}
      </p>

      <P>
        Dengan menggunakan aplikasi E-Rapor Daycare, Anda dianggap telah membaca dan menyetujui
        syarat berikut. Bila Anda tidak setuju, mohon tidak menggunakan aplikasi ini.
      </P>

      <Judul>Tujuan layanan</Judul>
      <P>
        Aplikasi ini adalah sistem informasi jurnal harian anak daycare: mencatat kehadiran,
        pola makan, tidur, kesehatan, dan perkembangan anak, lalu menampilkannya kepada orang tua
        melalui portal masing-masing.
      </P>

      <Judul>Peran dan tanggung jawab akun</Judul>
      <Daftar
        items={[
          'Setiap pengguna memperoleh akun dengan peran masing-masing: administrator, guru, atau orang tua.',
          'Akun tidak boleh dipinjamkan atau dibagikan kepada pihak lain. Pengguna bertanggung jawab atas semua aktivitas pada akunnya.',
          'Administrator bertanggung jawab atas data master (siswa, guru, rombelen, dan akun) serta menjaga kerahasiaan data anak.',
        ]}
      />

      <Judul>Data dan foto anak</Judul>
      <Daftar
        items={[
          'Data anak dan foto kegiatan hanya digunakan untuk keperluan laporan perkembangan dalam lingkup daycare.',
          'Foto ditampilkan kepada orang tua anak yang bersangkutan saja; setiap orang tua hanya dapat melihat laporan anaknya sendiri.',
          'Pihak luar tidak diberi akses, kecuali diwajibkan oleh hukum atau atas permintaan tertulis orang tua/wali.',
        ]}
      />

      <Judul>Penggunaan yang dilarang</Judul>
      <Daftar
        items={[
          'Mengubah, menghapus, atau memalsukan data anak dan laporan tanpa kewenangan.',
          'Mengakses portal atau data yang bukan menjadi tanggung jawabnya.',
          'Menggunakan aplikasi untuk tujuan yang melanggar hukum atau merugikan pihak lain.',
        ]}
      />

      <Judul>Ketersediaan layanan</Judul>
      <P>
        Layanan disediakan &quot;sebagaimana adanya&quot;. Pemeliharaan, gangguan jaringan, atau
        perubahan kebijakan penyedia layanan pihak ketiga (Google dan Vercel) dapat menyebabkan
        layanan terganggu sementara. Pengelola berusaha menjaga data tetap utuh, namun tidak
        menjamin ketersediaan tanpa gangguan.
      </P>

      <Judul>Perubahan syarat</Judul>
      <P>
        Syarat ini dapat diperbarui sewaktu-waktu. Tanggal berlaku terbaru selalu tercantum di
        bagian atas halaman ini.
      </P>

      <Judul>Kontak</Judul>
      <P>
        Pertanyaan mengenai syarat ini? Hubungi pengelola aplikasi:{' '}
        <a className="font-medium text-[#173661] underline" href={`mailto:${KONTAK}`}>
          {KONTAK}
        </a>
      </P>

      <footer className="mt-10 border-t border-gray-200 pt-4 text-sm text-gray-500">
        © {new Date().getFullYear()} Daycare Tisa — Syarat &amp; Ketentuan E-Rapor Daycare.
      </footer>
    </main>
  )
}
