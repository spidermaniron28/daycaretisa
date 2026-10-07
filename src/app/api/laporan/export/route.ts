import ExcelJS from 'exceljs'
import { handler } from '@/lib/api'
import { wajibRole } from '@/lib/session'
import { listLaporanSiswa, listSiswa } from '@/lib/sheets'
import { KOSONG } from '@/lib/constants'
import type { DataLaporan, Siswa } from '@/lib/types'

export const dynamic = 'force-dynamic'
// Vercel: panggilan ke Google (unggah foto, tulis sheet) bisa lebih lambat dari
// batas bawaan 10 detik pada cold start.
export const maxDuration = 60
export const runtime = 'nodejs'

/* ---------------------------------------------------------------------------
 * Ekspor rekap laporan ke .xlsx (ExcelJS).
 *
 * Setiap laporan menghasilkan beberapa sheet: rekap kehadiran, detail makan,
 * detail tidur, kesehatan, dan rekap per anak. Nilai '-' dibiarkan kosong agar
 * tidak membingungkan saat di-pivot di Excel.
 * ------------------------------------------------------------------------- */

export const GET = handler(async (req: Request) => {
  const session = await wajibRole('admin', 'guru')
  const p = new URL(req.url).searchParams

  const bulan = Number(p.get('bulan') ?? new Date().getMonth() + 1)
  const tahun = Number(p.get('tahun') ?? new Date().getFullYear())
  const kelas = p.get('kelas') ?? ''
  const nis = p.get('nis') ?? ''

  if (!Number.isFinite(bulan) || bulan < 1 || bulan > 12) {
    return new Response('Parameter bulan tidak valid.', { status: 400 })
  }

  const semuaSiswa = await listSiswa()

  // Guru hanya boleh mengekspor lapangannya sendiri; admin boleh semua.
  const nipGuru = session.role === 'guru' ? session.idAsli : null

  // Tentukan anak mana yang dilaporkan.
  let anak: Siswa[]
  if (nis) {
    anak = semuaSiswa.filter((s) => s.nis === nis)
  } else if (kelas) {
    anak = semuaSiswa.filter((s) => s.kelas === kelas)
  } else {
    anak = semuaSiswa.filter((s) => (s.status || 'Aktif') === 'Aktif')
  }

  const prefix = `${tahun}-${String(bulan).padStart(2, '0')}`
  const laporanPerAnak = await Promise.all(
    anak.map(async (s) => ({ siswa: s, laporan: await listLaporanSiswa(s.nis) })),
  )

  const semuaLaporan: Array<{ siswa: Siswa; laporan: DataLaporan }> = []
  for (const { siswa: s, laporan } of laporanPerAnak) {
    for (const l of laporan) {
      if (nipGuru && l.guruNip !== nipGuru) continue
      if (l.tanggal.startsWith(prefix)) semuaLaporan.push({ siswa: s, laporan: l })
    }
  }

  if (semuaLaporan.length === 0) {
    return new Response(
      JSON.stringify({ error: `Tidak ada laporan pada ${bulan}/${tahun}${kelas ? ` kelas ${kelas}` : ''}.` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Urutkan per anak lalu per tanggal, supaya mudah dibaca.
  semuaLaporan.sort((a, b) =>
    a.siswa.nis === b.siswa.nis
      ? a.laporan.tanggal.localeCompare(b.laporan.tanggal)
      : a.siswa.nis.localeCompare(b.siswa.nis),
  )

  const wb = new ExcelJS.Workbook()
  wb.creator = 'E-Rapor Daycare'
  wb.created = new Date()

  buatSheetRingkasan(wb, semuaLaporan)
  buatSheetKehadiran(wb, semuaLaporan)
  buatSheetMakan(wb, semuaLaporan)
  buatSheetTidurKesehatan(wb, semuaLaporan)
  buatSheetPerAnak(wb, laporanPerAnak.filter((x) => x.laporan.length > 0))

  const namaFile = `Rekap-Laporan-${prefix}${kelas ? `-${kelas.replace(/[^\w-]/g, '')}` : ''}.xlsx`
  const buffer = await wb.xlsx.writeBuffer()

  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${namaFile}"`,
      'Cache-Control': 'no-store',
    },
  })
})

/* ------------------------------ Pembuat sheet ---------------------------- */

function gayaHeader(baris: ExcelJS.Row) {
  baris.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  baris.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
  baris.alignment = { vertical: 'middle', horizontal: 'center' }
  baris.height = 22
}

function kunciLebar(ws: ExcelJS.Worksheet, lebar: number[]) {
  lebar.forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })
}

function bersihkan(v: string): string {
  return !v || v === KOSONG ? '' : v
}

function buatSheetRingkasan(
  wb: ExcelJS.Workbook,
  data: Array<{ siswa: Siswa; laporan: DataLaporan }>,
) {
  const ws = wb.addWorksheet('Ringkasan')
  kunciLebar(ws, [14, 26, 16, 10, 10, 14, 14, 20, 34])

  ws.addRow([
    'NIS',
    'Nama Anak',
    'Kelas',
    'Jumlah Laporan',
    'Hadir',
    'Total Jam Tidur',
    'Jam Datang Rata²',
    'Jam Pulang Rata²',
    'Catatan',
  ])
  gayaHeader(ws.getRow(1))

  const perAnak = new Map<string, { siswa: Siswa; laporan: DataLaporan[] }>()
  for (const d of data) {
    const entry = perAnak.get(d.siswa.nis) ?? { siswa: d.siswa, laporan: [] }
    entry.laporan.push(d.laporan)
    perAnak.set(d.siswa.nis, entry)
  }

  for (const { siswa: s, laporan } of perAnak.values()) {
    const total = laporan.length
    const datang = rata(laporan.map((l) => l.datang))
    const pulang = rata(laporan.map((l) => l.pulang))
    ws.addRow([
      s.nis,
      s.nama,
      s.kelas,
      total,
      total,
      `${jumlahMenit(laporan.map((l) => l.tidur.durasi))} menit`,
      datang,
      pulang,
      '',
    ])
  }

  ws.autoFilter = { from: 'A1', to: 'I1' }
}

function buatSheetKehadiran(
  wb: ExcelJS.Workbook,
  data: Array<{ siswa: Siswa; laporan: DataLaporan }>,
) {
  const ws = wb.addWorksheet('Kehadiran')
  kunciLebar(ws, [14, 26, 14, 14, 12, 12, 20])

  ws.addRow(['NIS', 'Nama Anak', 'Kelas', 'Tanggal', 'Datang', 'Pulang', 'Penjemput'])
  gayaHeader(ws.getRow(1))

  for (const { siswa: s, laporan: l } of data) {
    ws.addRow([s.nis, s.nama, s.kelas, l.tanggal, l.datang, l.pulang, bersihkan(l.penjemput)])
  }

  ws.autoFilter = { from: 'A1', to: 'G1' }
}

function buatSheetMakan(
  wb: ExcelJS.Workbook,
  data: Array<{ siswa: Siswa; laporan: DataLaporan }>,
) {
  const ws = wb.addWorksheet('Makan')
  kunciLebar(ws, [14, 24, 14, 18, 16, 12, 20, 16, 12, 20, 12, 20, 12])

  ws.addRow([
    'NIS',
    'Nama Anak',
    'Tanggal',
    'Sarapan',
    'Porsi Sarapan',
    'Catatan',
    'Camilan Pagi',
    'Porsi',
    'Catatan',
    'Makan Siang',
    'Porsi',
    'Camilan Sore',
    'Porsi',
  ])
  gayaHeader(ws.getRow(1))

  for (const { siswa: s, laporan: l } of data) {
    ws.addRow([
      s.nis,
      s.nama,
      l.tanggal,
      bersihkan(l.sarapan.menu),
      bersihkan(l.sarapan.habis),
      bersihkan(l.sarapan.catatan),
      bersihkan(l.campagi.menu),
      bersihkan(l.campagi.habis),
      bersihkan(l.campagi.catatan),
      bersihkan(l.siang.menu),
      bersihkan(l.siang.habis),
      bersihkan(l.camsore.menu),
      bersihkan(l.camsore.habis),
    ])
  }

  ws.autoFilter = { from: 'A1', to: 'M1' }
}

function buatSheetTidurKesehatan(
  wb: ExcelJS.Workbook,
  data: Array<{ siswa: Siswa; laporan: DataLaporan }>,
) {
  const ws = wb.addWorksheet('Tidur & Kesehatan')
  kunciLebar(ws, [14, 24, 14, 12, 12, 14, 14, 12, 12, 14, 14, 18])

  ws.addRow([
    'NIS',
    'Nama Anak',
    'Tanggal',
    'Mulai Tidur',
    'Bangun',
    'Durasi',
    'Kualitas',
    'Suhu',
    'Kondisi',
    'BAK/BAB',
    'Kebersihan',
    'Obat/Vitamin',
  ])
  gayaHeader(ws.getRow(1))

  for (const { siswa: s, laporan: l } of data) {
    ws.addRow([
      s.nis,
      s.nama,
      l.tanggal,
      bersihkan(l.tidur.datang),
      bersihkan(l.tidur.bangun),
      bersihkan(l.tidur.durasi),
      bersihkan(l.tidur.kualitas),
      bersihkan(l.kesehatan.suhu),
      bersihkan(l.kesehatan.kondisi),
      bersihkan(l.kesehatan.bakBab),
      bersihkan(l.kesehatan.kebersihan),
      bersihkan(l.kesehatan.obat),
    ])
  }

  ws.autoFilter = { from: 'A1', to: 'L1' }
}

function buatSheetPerAnak(
  wb: ExcelJS.Workbook,
  data: Array<{ siswa: Siswa; laporan: DataLaporan[] }>,
) {
  const ws = wb.addWorksheet('Detail per Anak')
  kunciLebar(ws, [26, 14, 40])

  ws.addRow(['Nama Anak', 'Tanggal', 'Catatan Pengasuh'])
  gayaHeader(ws.getRow(1))

  for (const { siswa: s, laporan } of data) {
    for (const l of laporan) {
      ws.addRow([s.nama, l.tanggal, bersihkan(l.perilaku.catatanPengasuh)])
    }
  }
}

/* ------------------------------ Perhitungan ----------------------------- */

/** Rata-rata jam "HH:MM" dalam menit, diformat ulang jadi "HH:MM". */
function rata(jam: string[]): string {
  const menit = jam.map(keMenit).filter((n): n is number => n !== null)
  if (menit.length === 0) return ''
  const total = menit.reduce((a, b) => a + b, 0) / menit.length
  const j = Math.floor(total / 60)
  const m = Math.round(total % 60)
  return `${String(j).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function keMenit(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Jumlah durasi tidur expressed dalam menit — durasi bisa "1 jam 30 menit" atau "01:30". */
function jumlahMenit(durasi: string[]): number {
  let total = 0
  for (const d of durasi) {
    const teks = d.trim()
    if (!teks || teks === KOSONG) continue

    if (/^\d{1,2}:\d{2}$/.test(teks)) {
      const m = keMenit(teks)
      if (m !== null) total += m
      continue
    }

    const jam = /(\d+)\s*jam/i.exec(teks)
    const menit = /(\d+)\s*menit/i.exec(teks)
    if (jam) total += Number(jam[1]) * 60
    if (menit) total += Number(menit[1])
  }
  return total
}