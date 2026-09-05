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

export { db }