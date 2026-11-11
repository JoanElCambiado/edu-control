import type { NextFunction, Request, Response } from 'express'
import type { Rol } from '@prisma/client'
import { verificarJwt, type JwtPayload } from '../utils/jwt.js'

/**
 * Extensión del tipo Request de Express para exponer la identidad
 * extraída del JWT stateless y el estado de coexistencia offline.
 */
declare module 'express-serve-static-core' {
  interface Request {
    usuario?: JwtPayload
    autenticadoPorJwt?: boolean
    modoSyncOffline?: boolean
  }
}

/**
 * Determina si la petición pertenece al canal de sincronización offline-first
 * (`/api/sync/...` o cabecera explícita `x-offline-sync`), el cual debe poder
 * operar cuando un dispositivo autenticó localmente en Dexie sin red y luego
 * recupera conectividad para vaciar su cola (`outbox`).
 */
function esRutaSincronizacionOffline(req: Request): boolean {
  const rutaCompleta = `${req.baseUrl ?? ''}${req.path ?? ''}`
  if (rutaCompleta.startsWith('/api/sync') || req.originalUrl.startsWith('/api/sync')) {
    return true
  }
  return req.headers['x-offline-sync'] === 'true'
}

function extraerBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader || typeof authHeader !== 'string') {
    return null
  }
  const [esquema, token] = authHeader.trim().split(/\s+/)
  if (!esquema || esquema.toLowerCase() !== 'bearer' || !token) {
    return null
  }
  return token
}

/**
 * Middleware de autenticación stateless con JWT que coexiste con el flujo offline-first:
 * - En peticiones online estándar: exige y valida el `Authorization: Bearer <jwt>`.
 * - En rutas de sincronización (`/api/sync/...`): valida el JWT si está presente y vigente,
 *   pero permite el paso controlado cuando el cliente opera en modo reconciliación offline
 *   (por ejemplo, descarga inicial del catálogo para login offline o vaciado de cola outbox
 *   tras una sesión iniciada sin conexión).
 */
export function authJwt(req: Request, res: Response, next: NextFunction): void {
  const token = extraerBearerToken(req)
  const esSync = esRutaSincronizacionOffline(req)

  if (token) {
    try {
      req.usuario = verificarJwt(token)
      req.autenticadoPorJwt = true
      req.modoSyncOffline = false
      next()
      return
    } catch (error) {
      // Si el token expiró mientras el dispositivo estuvo sin red durante horas/días,
      // no se debe bloquear el vaciado de la cola de sincronización offline.
      if (esSync) {
        req.autenticadoPorJwt = false
        req.modoSyncOffline = true
        next()
        return
      }

      const mensaje = error instanceof Error ? error.message : 'Token JWT inválido'
      res.status(401).json({ error: `No autorizado: ${mensaje}` })
      return
    }
  }

  if (esSync) {
    req.autenticadoPorJwt = false
    req.modoSyncOffline = true
    next()
    return
  }

  res.status(401).json({
    error: 'No autorizado: se requiere cabecera Authorization con esquema Bearer JWT',
  })
}

/**
 * Middleware estricto para endpoints exclusivamente online que siempre requieren JWT válido.
 */
export function exigirJwt(req: Request, res: Response, next: NextFunction): void {
  const token = extraerBearerToken(req)
  if (!token) {
    res.status(401).json({
      error: 'No autorizado: token JWT ausente',
    })
    return
  }

  try {
    req.usuario = verificarJwt(token)
    req.autenticadoPorJwt = true
    req.modoSyncOffline = false
    next()
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Token JWT inválido'
    res.status(401).json({ error: `No autorizado: ${mensaje}` })
  }
}

/**
 * Middleware de autorización por rol (RBAC) sobre el payload del JWT verificado.
 */
export function exigirRol(...rolesPermitidos: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ error: 'No autorizado: sesión JWT no verificada' })
      return
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      res.status(403).json({
        error: `Acceso denegado: se requiere uno de los roles [${rolesPermitidos.join(', ')}]`,
      })
      return
    }
    next()
  }
}

