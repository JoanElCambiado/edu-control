export type Rol = 'ADMINISTRADOR' | 'RECEPCION' | 'USUARIO'

export type EstadoPrestamo = 'prestado' | 'devuelto' | 'atrasado'

/** Estado de un registro dentro de la cola de sincronizacion (outbox por fila). */
export type SyncStatus = 'pendiente' | 'enviado' | 'error'

/** Entidades que participan en la cola, en orden de dependencia. */
export type EntidadSync = 'herramientas' | 'usuarios' | 'proyectos' | 'prestamos'

/** Metadatos de cola que toda entidad sincronizable debe exponer. */
export interface SyncMeta {
  syncStatus: SyncStatus
  syncIntentos?: number
  syncError?: string
}

export interface Usuario extends SyncMeta {
  id: string
  /** Clave natural del actor. Índice único en Dexie (&documento). §3.5 */
  documento: string
  nombre: string
  rol: Rol
  contrasena?: string
  createdAt: number
  updatedAt: number
}

export type EstadoFisico = 'excelente' | 'bueno' | 'regular' | 'mantenimiento'

export interface Herramienta extends SyncMeta {
  id: string
  nombre: string
  categoria: string
  estadoFisico: EstadoFisico
  cantidad: number
  disponible: boolean
  createdAt: number
  updatedAt: number
}

export interface Proyecto extends SyncMeta {
  id: string
  nombre: string
  descripcion?: string
  createdAt: number
  updatedAt: number
}

export interface Prestamo extends SyncMeta {
  id: string
  herramientaId: string
  /** Única referencia al receptor. `receptor` se eliminó por redundancia 3NF (§3.3). */
  usuarioId: string
  proyectoId?: string
  fechaSalida: number
  fechaDevolucion: number
  fechaDevolucionReal?: number
  estado: EstadoPrestamo
  createdAt: number
}
