import { db } from '../database/db'
import type { EntidadSync, SyncMeta, Usuario } from '../database/models'

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api') as string
const API_URL = `${API_BASE}/sync`

/** Tamano de cada rafaga enviada a la nube. */
const TAMANO_LOTE = 50
/** Tope de reintentos antes de dejar el registro en cuarentena. */
const MAX_INTENTOS = 5

/** Orden de dependencia: Catalogos -> Usuarios -> Proyectos -> Prestamos. */
const ORDEN_SYNC: EntidadSync[] = ['herramientas', 'usuarios', 'proyectos', 'prestamos']

export interface ResultadoSync {
  enviados: number
  rechazados: number
}

interface RespuestaSync {
  procesados?: string[]
  rechazados?: Array<{ id: string; motivo: string }>
}

type FilaSync = SyncMeta & { id: string }

interface ApiUsuario {
  id: string
  nombre: string
  rol: Usuario['rol']
  contrasena?: string
  createdAt: string
  updatedAt: string
}

/** Nunca asumir conexion: toda llamada de red pasa por aqui primero. */
export function hayRed(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export async function contarPendientes(): Promise<number> {
  const totales = await Promise.all(
    ORDEN_SYNC.map((entidad) =>
      db.table(entidad).where('syncStatus').anyOf('pendiente', 'error').count(),
    ),
  )
  return totales.reduce((acc, n) => acc + n, 0)
}

/** Conteo exclusivo de la tabla `prestamos` en estado 'pendiente' (badge de la UI). */
export async function contarPrestamosPendientes(): Promise<number> {
  return db.prestamos.where('syncStatus').equals('pendiente').count()
}

async function obtenerLote(entidad: EntidadSync): Promise<FilaSync[]> {
  const filas = (await db
    .table(entidad)
    .where('syncStatus')
    .anyOf('pendiente', 'error')
    .limit(TAMANO_LOTE)
    .toArray()) as FilaSync[]

  return filas.filter((fila) => (fila.syncIntentos ?? 0) < MAX_INTENTOS)
}

/**
 * Marca como 'enviado' SOLO los ids confirmados por el servidor y que
 * realmente formaban parte del lote enviado.
 */
async function marcarEnviados(
  entidad: EntidadSync,
  idsConfirmados: string[],
  idsDelLote: Set<string>,
): Promise<string[]> {
  const ids = idsConfirmados.filter((id) => idsDelLote.has(id))
  if (ids.length === 0) return []

  const tabla = db.table(entidad)
  await db.transaction('rw', tabla, async () => {
    for (const id of ids) {
      await tabla.update(id, {
        syncStatus: 'enviado',
        syncIntentos: 0,
        syncError: undefined,
      })
    }
  })
  return ids
}

/** Solo para rechazos SEMANTICOS del servidor (nunca para fallos de red). */
async function marcarError(
  entidad: EntidadSync,
  fallos: Array<{ id: string; motivo: string }>,
  idsDelLote: Set<string>,
): Promise<string[]> {
  const validos = fallos.filter((fallo) => idsDelLote.has(fallo.id))
  if (validos.length === 0) return []

  const tabla = db.table(entidad)
  await db.transaction('rw', tabla, async () => {
    for (const { id, motivo } of validos) {
      const actual = (await tabla.get(id)) as FilaSync | undefined
      if (!actual) continue
      await tabla.update(id, {
        syncStatus: 'error',
        syncIntentos: (actual.syncIntentos ?? 0) + 1,
        syncError: motivo,
      })
    }
  })
  return validos.map((fallo) => fallo.id)
}

/** Envia una entidad en rafagas hasta agotar su cola. */
async function empujarEntidad(entidad: EntidadSync): Promise<ResultadoSync> {
  let enviados = 0
  let rechazados = 0

  for (;;) {
    const lote = await obtenerLote(entidad)
    if (lote.length === 0) break

    const idsDelLote = new Set(lote.map((fila) => fila.id))

    // Cortocircuito: si la red se cayo a mitad de la rafaga, no se toca nada.
    if (!hayRed()) {
      throw new Error('Sin conexion')
    }

    let res: Response
    try {
      res = await fetch(`${API_URL}/${entidad}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lote),
      })
    } catch (error) {
      // Fallo de RED: el lote NO se toca, sigue 'pendiente' y no consume intentos.
      throw new Error(
        `Sync ${entidad}: sin respuesta de la nube (${
          error instanceof Error ? error.message : 'error de red'
        })`,
      )
    }

    if (!res.ok) {
      // Fallo de TRANSPORTE/SERVIDOR: tampoco se marca nada, se reintenta intacto.
      throw new Error(`Sync ${entidad}: HTTP ${res.status}`)
    }

    let data: RespuestaSync
    try {
      data = (await res.json()) as RespuestaSync
    } catch {
      // Respuesta ilegible: no hay ACK valido, el lote sigue 'pendiente'.
      throw new Error(`Sync ${entidad}: respuesta invalida de la nube`)
    }

    // Sin ACK explicito no se asume exito.
    if (!Array.isArray(data.procesados)) {
      throw new Error(`Sync ${entidad}: la nube no confirmo los registros (falta 'procesados')`)
    }

    const confirmados = await marcarEnviados(entidad, data.procesados, idsDelLote)
    const fallidos = await marcarError(entidad, data.rechazados ?? [], idsDelLote)

    enviados += confirmados.length
    rechazados += fallidos.length

    // Si el servidor no movio ningun registro, evitar bucle infinito.
    if (confirmados.length === 0 && fallidos.length === 0) break
    if (lote.length < TAMANO_LOTE) break
  }

  return { enviados, rechazados }
}

/** Procesa la cola completa respetando el orden de dependencias. */
export async function procesarCola(): Promise<ResultadoSync> {
  const total: ResultadoSync = { enviados: 0, rechazados: 0 }

  for (const entidad of ORDEN_SYNC) {
    const parcial = await empujarEntidad(entidad)
    total.enviados += parcial.enviados
    total.rechazados += parcial.rechazados
  }

  return total
}

/** Pull de usuarios. No sobrescribe filas locales con cambios sin enviar. */
export async function sincronizarUsuarios(): Promise<void> {
  if (!hayRed()) {
    throw new Error('Sin conexion')
  }

  const res = await fetch(`${API_URL}/usuarios`)
  if (!res.ok) {
    throw new Error(`Error al sincronizar usuarios: ${res.status}`)
  }

  const data = (await res.json()) as ApiUsuario[]
  if (!Array.isArray(data)) {
    throw new Error('Respuesta invalida al sincronizar usuarios')
  }

  await db.transaction('rw', db.usuarios, async () => {
    for (const u of data) {
      const local = await db.usuarios.get(u.id)
      if (local && local.syncStatus !== 'enviado') continue // gana el cambio local

      await db.usuarios.put({
        id: u.id,
        nombre: u.nombre,
        rol: u.rol,
        contrasena: u.contrasena,
        createdAt: new Date(u.createdAt).getTime(),
        updatedAt: new Date(u.updatedAt).getTime(),
        syncStatus: 'enviado',
        syncIntentos: 0,
      })
    }
  })
}

/** Ciclo completo: pull del catalogo de usuarios + push de la cola. */
export async function sincronizarDatos(): Promise<ResultadoSync> {
  if (!hayRed()) {
    throw new Error('Sin conexion')
  }
  await sincronizarUsuarios().catch(() => undefined) // el pull no debe bloquear el push
  return procesarCola()
}
