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

export { db }