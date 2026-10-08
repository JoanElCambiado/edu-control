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

// v5: `documento` como índice ÚNICO en usuarios (§3.5) y eliminación de
// `receptor` en prestamos por redundancia 3NF (§3.3).
db.version(5)
  .stores({
    usuarios: 'id, &documento, nombre, rol, syncStatus',
    prestamos: 'id, herramientaId, usuarioId, estado, fechaDevolucion, syncStatus',
  })
  .upgrade(async (tx) => {
    // Backfill obligatorio: sin `documento` la fila no entraría al índice único
    // y quedaría invisible para la búsqueda por clave natural.
    await tx
      .table('usuarios')
      .toCollection()
      .modify((usuario: { id: string; documento?: string; syncStatus?: string }) => {
        if (!usuario.documento) {
          usuario.documento = `SIN-DOC-${usuario.id.slice(0, 8)}`
          // Debe reenviarse para que la nube reciba la clave natural.
          usuario.syncStatus = 'pendiente'
        }
      })

    // Elimina la propiedad redundante de los préstamos existentes.
    await tx
      .table('prestamos')
      .toCollection()
      .modify((prestamo: { receptor?: string }) => {
        delete prestamo.receptor
      })
  })

export { db }