import { db } from '../database/db'
import type { Usuario } from '../database/models'

interface ApiUsuario {
  id: string
  nombre: string
  rol: Usuario['rol']
  createdAt: string
  updatedAt: string
  _count?: { prestamos: number }
}

export async function sincronizarUsuarios(): Promise<void> {
  const res = await fetch('http://localhost:4000/api/sync/usuarios')
  if (!res.ok) {
    throw new Error(`Error al sincronizar usuarios: ${res.status}`)
  }

  const data = (await res.json()) as ApiUsuario[]

  const usuarios: Usuario[] = data.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    rol: u.rol,
    createdAt: new Date(u.createdAt).getTime(),
    updatedAt: new Date(u.updatedAt).getTime(),
  }))

  await db.usuarios.bulkPut(usuarios)
}