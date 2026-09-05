import type { Rol } from '../database/models'

export interface SesionUsuario {
  id: string
  nombre: string
  rol: Rol
}

const SESSION_KEY = 'edu-control-session'

export function guardarSesion(usuario: SesionUsuario) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(usuario))
}

export function obtenerSesion(): SesionUsuario | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SesionUsuario
  } catch {
    return null
  }
}

export function cerrarSesion() {
  localStorage.removeItem(SESSION_KEY)
}