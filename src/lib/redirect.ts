import type { Role } from './types'

/** Halaman beranda milik tiap role — dipakai saat pengguna salah membuka portal. */
export function roleLainDari(role: Role): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'guru':
      return '/guru'
    case 'siswa':
      return '/ortu'
  }
}