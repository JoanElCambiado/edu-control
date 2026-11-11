import { randomBytes } from 'node:crypto'

/**
 * Formato estricto del token opaco: prefijo `tok_` seguido de 8 caracteres hexadecimales.
 * Ejemplo: `tok_9f8a7b6c`
 */
const PATRON_TOKEN = /^tok_[0-9a-f]{8}$/

interface RegistroBoveda {
  token: string
  valorOriginal: string
  creadoEn: number
}

/**
 * Bóveda aislada en memoria (encapsulada en el cierre del módulo).
 * No existe relación matemática (ni hash ni cifrado reversible por clave)
 * entre el valor sensible original y el token generado.
 */
const bovedaPorToken = new Map<string, RegistroBoveda>()
const bovedaPorValor = new Map<string, string>()

/**
 * Genera un identificador aleatorio opaco con CSPRNG (`tok_` + 8 hex)
 * garantizando que no colisione con ningún token existente en la bóveda.
 */
function generarTokenUnico(): string {
  for (;;) {
    const hex = randomBytes(4).toString('hex')
    const candidato = `tok_${hex}`
    if (!bovedaPorToken.has(candidato)) {
      return candidato
    }
  }
}

/**
 * Verifica si una cadena cumple con la anatomía de un token de la bóveda (`tok_xxxxxxxx`).
 */
export function esTokenValido(valor: unknown): valor is string {
  return typeof valor === 'string' && PATRON_TOKEN.test(valor)
}

/**
 * Sustituye un dato sensible (ej. número de documento/cédula) por un token aleatorio
 * sin relación matemática con el valor original (`tok_` + 8 caracteres hexadecimales).
 *
 * - Si el valor ya es un token válido registrado en la bóveda, lo devuelve sin re-tokenizar.
 * - Si el valor sensible ya fue tokenizado previamente, retorna el mismo token asociado.
 */
export function tokenizar(valorSensible: string): string {
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
  const registro: RegistroBoveda = {
    token: nuevoToken,
    valorOriginal: limpio,
    creadoEn: Date.now(),
  }

  bovedaPorToken.set(nuevoToken, registro)
  bovedaPorValor.set(limpio, nuevoToken)

  return nuevoToken
}

/**
 * Recupera el dato sensible original a partir de su token opaco.
 * Debe invocarse únicamente cuando la operación de negocio lo requiera estrictamente.
 *
 * @returns El valor original o `null` si el token no existe o no es válido.
 */
export function detokenizar(token: string): string | null {
  if (!esTokenValido(token)) {
    return null
  }
  const registro = bovedaPorToken.get(token)
  return registro ? registro.valorOriginal : null
}

/**
 * Sustituye campos sensibles (por defecto `documento`) en un objeto o copia superficial
 * para su uso seguro en logs, exportaciones o payloads públicos.
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
 * Limpia la bóveda en memoria (útil para pruebas automatizadas o rotación de sesión).
 */
export function limpiarBoveda(): void {
  bovedaPorToken.clear()
  bovedaPorValor.clear()
}

/**
 * Devuelve métricas básicas de la bóveda sin exponer los datos almacenados.
 */
export function estadoBoveda(): { totalRegistros: number } {
  return { totalRegistros: bovedaPorToken.size }
}

export const tokenVault = {
  tokenizar,
  detokenizar,
  esTokenValido,
  tokenizarCampos,
  limpiarBoveda,
  estadoBoveda,
}

