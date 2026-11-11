import type { Rol } from '../database/models'
import { limpiarBoveda } from './tokenVault'

export interface SesionUsuario {
  id: string
  nombre: string
  rol: Rol
  /** JWT stateless emitido por el servidor cuando la autenticación ocurre online */
  token?: string
  /** Referencia opaca del documento en el Token Vault (ej. tok_9f8a7b6c) */
  documentoToken?: string
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

export function obtenerTokenJwt(): string | null {
  const sesion = obtenerSesion()
  return sesion?.token ?? null
}

export function obtenerCabecerasAuth(): Record<string, string> {
  const token = obtenerTokenJwt()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function cerrarSesion() {
  localStorage.removeItem(SESSION_KEY)
  limpiarBoveda()
}