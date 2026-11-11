/**
 * Formato estricto del token opaco: prefijo `tok_` seguido de 8 caracteres hexadecimales.
 * Ejemplo: `tok_9f8a7b6c`
 */
const PATRON_TOKEN = /^tok_[0-9a-f]{8}$/
const VAULT_STORAGE_KEY = 'edu-control-token-vault'

interface MapaPersistencia {
  /** token -> valorOriginal */
  t2v: Record<string, string>
  /** valorOriginal -> token */
  v2t: Record<string, string>
}

const bovedaPorToken = new Map<string, string>()
const bovedaPorValor = new Map<string, string>()
let hidratada = false

function obtenerAlmacenamiento(): Storage | null {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Entornos sin acceso a Web Storage (SSR o sandboxes restringidos)
  }
  return null
}

function hidratarBoveda(): void {
  if (hidratada) return
  hidratada = true

  const storage = obtenerAlmacenamiento()
  if (!storage) return

  try {
    const raw = storage.getItem(VAULT_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<MapaPersistencia>
    if (parsed.t2v && typeof parsed.t2v === 'object') {
      for (const [token, valor] of Object.entries(parsed.t2v)) {
        if (PATRON_TOKEN.test(token) && typeof valor === 'string') {
          bovedaPorToken.set(token, valor)
          bovedaPorValor.set(valor, token)
        }
      }
    }
  } catch {
    // Si el almacenamiento está corrupto, se inicia con la bóveda limpia en memoria
  }
}

function persistirBoveda(): void {
  const storage = obtenerAlmacenamiento()
  if (!storage) return

  try {
    const data: MapaPersistencia = {
      t2v: Object.fromEntries(bovedaPorToken.entries()),
      v2t: Object.fromEntries(bovedaPorValor.entries()),
    }
    storage.setItem(VAULT_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Falla silenciosa si la cuota de almacenamiento está llena
  }
}

function generarHexAleatorio8(): string {
  const bytes = new Uint8Array(4)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 4; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function generarTokenUnico(): string {
  for (;;) {
    const candidato = `tok_${generarHexAleatorio8()}`
    if (!bovedaPorToken.has(candidato)) {
      return candidato
    }
  }
}

/**
 * Verifica si un valor tiene el formato de token opaco (`tok_xxxxxxxx`).
 */
export function esTokenValido(valor: unknown): valor is string {
  return typeof valor === 'string' && PATRON_TOKEN.test(valor)
}

/**
 * Sustituye un dato sensible (como el documento/cédula) por un token aleatorio
 * sin relación matemática con el valor original (`tok_` + 8 caracteres hexadecimales).
 */
export function tokenizar(valorSensible: string): string {
  hidratarBoveda()

  const limpio = valorSensible.trim()
  if (!limpio) {
    throw new Error('TokenVault: no se puede tokenizar un valor vacío')
  }

  if (esTokenValido(limpio) && bovedaPorToken.has(limpio)) {
    return limpio
  }

  const existente = bovedaPorValor.get(limpio)
  if (existente) {
    return existente
  }

  const nuevoToken = generarTokenUnico()
  bovedaPorToken.set(nuevoToken, limpio)
  bovedaPorValor.set(limpio, nuevoToken)
  persistirBoveda()

  return nuevoToken
}

/**
 * Registra explícitamente un par (token, valorOriginal) en la bóveda local
 * (por ejemplo, al recibir un token emitido por el backend tras autenticar online).
 */
export function registrarParEnBoveda(token: string, valorOriginal: string): void {
  hidratarBoveda()
  const limpio = valorOriginal.trim()
  if (!esTokenValido(token) || !limpio) return

  bovedaPorToken.set(token, limpio)
  bovedaPorValor.set(limpio, token)
  persistirBoveda()
}

/**
 * Recupera el valor sensible original desde la bóveda local cuando sea estrictamente necesario.
 */
export function detokenizar(token: string): string | null {
  hidratarBoveda()
  if (!esTokenValido(token)) {
    return null
  }
  return bovedaPorToken.get(token) ?? null
}

/**
 * Sustituye campos sensibles (por defecto `documento`) en un objeto superficialmente
 * antes de enviarlo a logs, exportaciones o payloads públicos.
 */
export function tokenizarCampos<T extends Record<string, unknown>>(
  objeto: T,
  campos: Array<keyof T> = ['documento' as keyof T],
): T {
  const copia = { ...objeto }
  for (const campo of campos) {
    const valor = copia[campo]
    if (typeof valor === 'string' && valor.trim().length > 0) {
      copia[campo] = tokenizar(valor) as T[keyof T]
    }
  }
  return copia
}

/**
 * Vacía la bóveda local en memoria y en el almacenamiento de sesión.
 */
export function limpiarBoveda(): void {
  bovedaPorToken.clear()
  bovedaPorValor.clear()
  hidratada = true
  const storage = obtenerAlmacenamiento()
  try {
    storage?.removeItem(VAULT_STORAGE_KEY)
  } catch {
    // Ignorar errores de limpieza en entornos sin storage
  }
}

export const tokenVault = {
  tokenizar,
  detokenizar,
  registrarParEnBoveda,
  esTokenValido,
  tokenizarCampos,
  limpiarBoveda,
}

