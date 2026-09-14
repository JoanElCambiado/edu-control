import Dexie, { type EntityTable } from 'dexie'
import type { Herramienta, Prestamo, Proyecto, Usuario } from './models'

export type EduControlDatabase = Dexie & {
  usuarios: EntityTable<Usuario, 'id'>
  herramientas: EntityTable<Herramienta, 'id'>
  proyectos: EntityTable<Proyecto, 'id'>
  prestamos: EntityTable<Prestamo, 'id'>
}

const db = new Dexie('edu-control') as EduControlDatabase

db.version(1).stores({
  usuarios: 'id, nombre, rol',
  herramientas: 'id, nombre',
  proyectos: 'id, nombre',
  prestamos: 'id, herramientaId, usuarioId, proyectoId, estado, fechaDevolucionEsperada',
})

db.version(2).stores({
  herramientas: 'id, nombre, categoria',
})

db.version(3).stores({
  prestamos: 'id, herramientaId, usuarioId, estado, fechaDevolucion, receptor',
})

// v4: la cola de sincronizacion necesita `syncStatus` INDEXADO en las 4 tablas
// para poder resolver where('syncStatus').anyOf('pendiente', 'error').
db.version(4)
  .stores({
    usuarios: 'id, nombre, rol, syncStatus',
    herramientas: 'id, nombre, categoria, syncStatus',
    proyectos: 'id, nombre, syncStatus',
    prestamos: 'id, herramientaId, usuarioId, estado, fechaDevolucion, receptor, syncStatus',
  })
  .upgrade(async (tx) => {
    // Todo lo creado antes de la cola se considera no enviado.
    const marcar = { syncStatus: 'pendiente' as const, syncIntentos: 0 }
    await tx.table('usuarios').toCollection().modify(marcar)
    await tx.table('herramientas').toCollection().modify(marcar)
    await tx.table('proyectos').toCollection().modify(marcar)
    await tx.table('prestamos').toCollection().modify(marcar)
  })

export { db }