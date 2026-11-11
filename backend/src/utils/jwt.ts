import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Rol } from '@prisma/client'
import { esTokenValido, tokenizar } from '../services/tokenVault.js'

const SECRETO_POR_DEFECTO = 'edu-control-jwt-secret-local-dev'
const DURACION_POR_DEFECTO_SEGUNDOS = 8 * 60 * 60 // 8 horas

/**
 * 1. Header estándar de un JSON Web Token (RFC 7519).
 */
export interface JwtHeader {
  alg: 'HS256'
  typ: 'JWT'
}

/**
 * 2. Payload de sesión stateless de Edu-Control.
 * El documento sensible jamás viaja en texto plano dentro del JWT;
 * únicamente viaja su referencia opaca de la bóveda (`tok_xxxxxxxx`).
 */
export interface JwtPayload {
  /** Identificador único del usuario (UUID) */
  id: string
  /** Rol de autorización del usuario */
  rol: Rol
  /** Referencia tokenizada del documento (`tok_...`) */
  documento: string
  /** Alias explícito de la referencia tokenizada del documento (`tok_...`) */
  documentoToken: string
  /** Timestamp de emisión (segundos UNIX) */
  iat: number
  /** Timestamp de expiración (segundos UNIX) */
  exp: number
}

export interface DatosEmisionJwt {
  id: string
  rol: Rol
  /** Puede recibir el documento original (se tokenizará automáticamente) o un token `tok_...` */
  documento: string
}

function obtenerSecretoJwt(): string {
  const secreto = process.env.JWT_SECRET?.trim()
  return secreto && secreto.length > 0 ? secreto : SECRETO_POR_DEFECTO
}

function codificarBase64Url(objeto: unknown): string {
  return Buffer.from(JSON.stringify(objeto), 'utf8').toString('base64url')
}

function decodificarBase64Url<T>(segmento: string): T {
  const json = Buffer.from(segmento, 'base64url').toString('utf8')
  return JSON.parse(json) as T
}

/**
 * 3. Signature: Calcula la firma digital HMAC-SHA256 sobre `header.payload`
 * utilizando la clave secreta `JWT_SECRET`.
 */
function firmarSegmentos(headerB64: string, payloadB64: string, secreto: string): string {
  return createHmac('sha256', secreto)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url')
}

/**
 * Construye y firma un JWT estándar (`header.payload.signature`) con algoritmo HS256.
 * Garantiza que el documento en el payload esté tokenizado (`tok_xxxxxxxx`).
 */
export function firmarJwt(
  datos: DatosEmisionJwt,
  duracionSegundos: number = DURACION_POR_DEFECTO_SEGUNDOS,
): string {
  const header: JwtHeader = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const refTokenizada = esTokenValido(datos.documento)
    ? datos.documento
    : tokenizar(datos.documento)

  const ahora = Math.floor(Date.now() / 1000)
  const payload: JwtPayload = {
    id: datos.id,
    rol: datos.rol,
    documento: refTokenizada,
    documentoToken: refTokenizada,
    iat: ahora,
    exp: ahora + duracionSegundos,
  }

  const headerB64 = codificarBase64Url(header)
  const payloadB64 = codificarBase64Url(payload)
  const signature = firmarSegmentos(headerB64, payloadB64, obtenerSecretoJwt())

  return `${headerB64}.${payloadB64}.${signature}`
}

/**
 * Valida la estructura, el algoritmo del Header, la firma criptográfica (HS256)
 * en tiempo constante y la vigencia temporal (`exp`) del JWT.
 *
 * @throws Error si el token es inválido, fue alterado o ha expirado.
 */
export function verificarJwt(token: string): JwtPayload {
  const partes = token.trim().split('.')
  if (partes.length !== 3) {
    throw new Error('Estructura JWT inválida: se esperaban 3 segmentos (header.payload.signature)')
  }

  const [headerB64, payloadB64, signatureRecibida] = partes
  if (!headerB64 || !payloadB64 || !signatureRecibida) {
    throw new Error('Segmentos JWT vacíos')
  }

  let header: Partial<JwtHeader>
  try {
    header = decodificarBase64Url<Partial<JwtHeader>>(headerB64)
  } catch {
    throw new Error('Header JWT malformado')
  }

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Algoritmo o tipo de JWT no soportado (se requiere HS256 / JWT)')
  }

  const signatureEsperada = firmarSegmentos(headerB64, payloadB64, obtenerSecretoJwt())
  const bufRecibida = Buffer.from(signatureRecibida, 'utf8')
  const bufEsperada = Buffer.from(signatureEsperada, 'utf8')

  if (
    bufRecibida.length !== bufEsperada.length ||
    !timingSafeEqual(bufRecibida, bufEsperada)
  ) {
    throw new Error('Firma digital del JWT inválida')
  }

  let payload: JwtPayload
  try {
    payload = decodificarBase64Url<JwtPayload>(payloadB64)
  } catch {
    throw new Error('Payload JWT malformado')
  }

  const ahora = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp <= ahora) {
    throw new Error('El token JWT ha expirado')
  }

  const refDoc = payload.documentoToken ?? payload.documento
  if (! payload.id || !payload.rol || !esTokenValido(refDoc)) {
    throw new Error('Payload JWT incompleto o sin referencia tokenizada válida (tok_...)')
  }

  return payload
}

