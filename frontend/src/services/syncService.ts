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

async function obtenerLote(entidad: EntidadSync): Promise<FilaSync[]> {
  const filas = (await db
    .table(entidad)
    .where('syncStatus')
    .anyOf('pendiente', 'error')
    .limit(TAMANO_LOTE)
    .toArray()) as FilaSync[]

  return filas.filter((fila) => (fila.syncIntentos ?? 0) < MAX_INTENTOS)
}

async function marcarEnviados(entidad: EntidadSync, ids: string[]): Promise<void> {
  if (ids.length === 0) return
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
}

async function marcarError(
  entidad: EntidadSync,
  fallos: Array<{ id: string; motivo: string }>,
): Promise<void> {
  if (fallos.length === 0) return
  const tabla = db.table(entidad)
  await db.transaction('rw', tabla, async () => {
    for (const { id, motivo } of fallos) {
      const actual = (await tabla.get(id)) as FilaSync | undefined
      if (!actual) continue
      await tabla.update(id, {
        syncStatus: 'error',
        syncIntentos: (actual.syncIntentos ?? 0) + 1,
        syncError: motivo,
      })
    }
  })
}

/** Envia una entidad en rafagas hasta agotar su cola. */
async function empujarEntidad(entidad: EntidadSync): Promise<ResultadoSync> {
  let enviados = 0
  let rechazados = 0

  for (;;) {
    const lote = await obtenerLote(entidad)
    if (lote.length === 0) break

    const res = await fetch(`${API_URL}/${entidad}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lote),
    })

    if (!res.ok) {
      // Fallo de transporte: el lote queda en 'error' y se reintenta en el proximo ciclo.
      await marcarError(
        entidad,
        lote.map((fila) => ({ id: fila.id, motivo: `HTTP ${res.status}` })),
      )
      throw new Error(`Sync ${entidad}: HTTP ${res.status}`)
    }

    const data = (await res.json()) as RespuestaSync
    const procesados = data.procesados ?? []
    const fallos = data.rechazados ?? []

    await marcarEnviados(entidad, procesados)
    await marcarError(entidad, fallos)

    enviados += procesados.length
    rechazados += fallos.length

    if (procesados.length === 0) break
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
  const res = await fetch(`${API_URL}/usuarios`)
  if (!res.ok) {
    throw new Error(`Error al sincronizar usuarios: ${res.status}`)
  }

  const data = (await res.json()) as ApiUsuario[]

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
