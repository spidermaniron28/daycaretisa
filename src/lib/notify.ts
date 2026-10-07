import 'server-only'
import nodemailer from 'nodemailer'
import type { DataLaporan, Guru, Siswa } from './types'
import { KOSONG } from './constants'

/* ---------------------------------------------------------------------------
 * Notifikasi email ke orang tua.
 *
 * Sengaja best-effort: kalau SMTP belum dikonfigurasi, fungsi ini mengembalikan
 * { terkirim: false, pesan } dan TIDAK melempar error — laporan sudah tersimpan
 * di Sheet dan itu yang paling penting.
 * ------------------------------------------------------------------------- */

export type HasilKirim = { terkirim: boolean; pesan?: string }

function transporter() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user, pass },
  })
}

export async function kirimNotifikasiEmail(
  laporan: DataLaporan,
  guru: Guru | null,
  siswa: Siswa | null,
): Promise<HasilKirim> {
  const tp = transporter()
  if (!tp) {
    return { terkirim: false, pesan: 'SMTP belum dikonfigurasi di environment server.' }
  }

  const tujuan = siswa?.emailOrtu?.trim()
  if (!tujuan) {
    return { terkirim: false, pesan: `Email orang tua untuk NIS ${laporan.nis} belum diisi.` }
  }

  try {
    await tp.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: tujuan,
      subject: `Laporan Harian ${siswa?.nama ?? laporan.nis} — ${laporan.tanggal}`,
      html: templateEmail(laporan, guru, siswa),
    })
    return { terkirim: true }
  } catch (e) {
    return { terkirim: false, pesan: (e as Error).message }
  }
}

/* ------------------------------ TEMPLATE -------------------------------- */

function esc(v: string): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function nilai(v: string): string {
  return !v || v === KOSONG
    ? '<span style="color:#94a3b8;font-style:italic">Belum diisi</span>'
    : esc(v)
}

function lencanaPorsi(status: string): string {
  if (!status || status === KOSONG) return '<span style="color:#94a3b8">-</span>'
  if (status.includes('Habis'))
    return '<span style="background:#d1fae5;color:#047857;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">Habis</span>'
  if (status.includes('Sisa'))
    return '<span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">Sisa</span>'
  return `<span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${esc(status)}</span>`
}

function baris(label: string, isi: string): string {
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;width:38%">${label}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;font-size:13px">${isi}</td>
  </tr>`
}

function blokMakan(judul: string, m: DataLaporan['sarapan']): string {
  return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px">
    <p style="margin:0 0 6px;font-weight:700;font-size:13px;color:#334155">${judul}</p>
    <p style="margin:0;font-size:13px;color:#475569">${nilai(m.menu)}</p>
    <p style="margin:6px 0 0">${lencanaPorsi(m.habis)}</p>
    ${m.catatan && m.catatan !== KOSONG ? `<p style="margin:6px 0 0;font-size:12px;color:#94a3b8;font-style:italic">${esc(m.catatan)}</p>` : ''}
  </div>`
}

function templateEmail(l: DataLaporan, guru: Guru | null, siswa: Siswa | null): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const namaAnak = siswa?.nama ?? `Anak (NIS ${l.nis})`

  const foto = l.fotoKegiatan.length
    ? `<p style="margin:20px 0 8px;font-weight:700;font-size:14px;color:#1e293b">Foto Kegiatan</p>
       <div style="display:flex;gap:8px;flex-wrap:wrap">
         ${l.fotoKegiatan
           .map(
             (u) =>
               `<a href="${esc(u)}" target="_blank" rel="noopener">
                  <img src="${esc(u)}" alt="Foto kegiatan" width="150" height="110"
                       style="border-radius:8px;object-fit:cover;border:1px solid #e2e8f0" />
                </a>`,
           )
           .join('')}
       </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:Poppins,Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:linear-gradient(90deg,#1e3a8a,#3b82f6);padding:24px 28px">
      <p style="margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#bfdbfe;font-weight:700">Jurnal Perkembangan</p>
      <h1 style="margin:4px 0 0;color:#ffffff;font-size:20px">${esc(l.tanggal)}</h1>
      <p style="margin:6px 0 0;color:#e0e7ff;font-size:13px">
        Pengajar: <strong>${esc(guru?.nama ?? 'Guru Kelas')}</strong>
      </p>
    </div>

    <div style="padding:28px">
      <p style="margin:0 0 20px;font-size:15px;color:#334155">
        Kepada Yth. Orang Tua <strong>${esc(namaAnak)}</strong>, berikut ringkasan kegiatan harian anak:
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
        ${baris('Jam Datang', `<strong>${esc(l.datang)}</strong>`)}
        ${baris('Jam Pulang', `<strong>${esc(l.pulang)}</strong>`)}
        ${baris('Penjemput', nilai(l.penjemput))}
      </table>

      <p style="margin:0 0 10px;font-weight:700;font-size:14px;color:#ea580c">Asupan Nutrisi</p>
      ${blokMakan('Sarapan Pagi', l.sarapan)}
      ${blokMakan('Camilan Pagi', l.campagi)}
      ${blokMakan('Makan Siang', l.siang)}
      ${blokMakan('Camilan Sore', l.camsore)}

      <p style="margin:24px 0 10px;font-weight:700;font-size:14px;color:#4f46e5">Istirahat Siang</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
        ${baris('Mulai Tidur', nilai(l.tidur.datang))}
        ${baris('Bangun', nilai(l.tidur.bangun))}
        ${baris('Durasi', nilai(l.tidur.durasi))}
        ${baris('Kualitas', nilai(l.tidur.kualitas))}
      </table>

      <p style="margin:24px 0 10px;font-weight:700;font-size:14px;color:#e11d48">Kesehatan &amp; Kebersihan</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
        ${baris('Suhu Tubuh', nilai(l.kesehatan.suhu))}
        ${baris('Kondisi Umum', nilai(l.kesehatan.kondisi))}
        ${baris('BAK / BAB', nilai(l.kesehatan.bakBab))}
        ${baris('Kebersihan Diri', nilai(l.kesehatan.kebersihan))}
        ${baris('Obat / Vitamin', nilai(l.kesehatan.obat))}
      </table>

      <p style="margin:24px 0 10px;font-weight:700;font-size:14px;color:#7c3aed">Perilaku &amp; Interaksi Sosial</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
        ${baris('Interaksi Teman', nilai(l.perilaku.interaksi))}
        ${baris('Kepatuhan', nilai(l.perilaku.kepatuhan))}
        ${baris('Kemandirian', nilai(l.perilaku.kemandirian))}
        ${baris('Mood Anak', nilai(l.perilaku.mood))}
      </table>

      <div style="margin-top:24px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px">
        <p style="margin:0 0 6px;font-weight:700;font-size:13px;color:#b45309">Catatan Pengasuh</p>
        <p style="margin:0;font-size:13px;color:#475569;line-height:1.6">${nilai(l.perilaku.catatanPengasuh)}</p>
      </div>

      ${foto}

      <div style="margin-top:28px;text-align:center">
        ${
          appUrl
            ? `<a href="${esc(appUrl)}/ortu" style="display:inline-block;background:#0b4291;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Lihat Jurnal Lengkap</a>`
            : ''
        }
      </div>
    </div>

    <div style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;font-size:11px;color:#94a3b8">
        Email ini dikirim otomatis oleh sistem E-Rapor Daycare.
      </p>
    </div>
  </div>
</body></html>`
}