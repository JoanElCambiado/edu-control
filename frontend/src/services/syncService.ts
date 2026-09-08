import { db } from '../database/db'
import type { Usuario } from '../database/models'

const API_URL = 'http://localhost:4000/api/sync'

interface ApiUsuario {
  id: string
  nombre: string
  rol: Usuario['rol']
  contrasena?: string
  createdAt: string
  updatedAt: string
  _count?: { prestamos: number }
}

export async function sincronizarUsuarios(): Promise<void> {
  const res = await fetch(`${API_URL}/usuarios`)
  if (!res.ok) {
    throw new Error(`Error al sincronizar usuarios: ${res.status}`)
  }

  const data = (await res.json()) as ApiUsuario[]

  const usuarios: Usuario[] = data.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    rol: u.rol,
    contrasena: u.contrasena,
    createdAt: new Date(u.createdAt).getTime(),
    updatedAt: new Date(u.updatedAt).getTime(),
  }))

  await db.usuarios.bulkPut(usuarios)
}

export async function sincronizarDatos(): Promise<void> {
  const [herramientas, proyectos, prestamos] = await Promise.all([
    db.herramientas.toArray(),
    db.proyectos.toArray(),
    db.prestamos.toArray(),
  ])

  const enviar = (ruta: string, body: unknown) =>
    fetch(`${API_URL}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  const [resHerramientas, resPrestamos, resProyectos] = await Promise.all([
    enviar('/herramientas', herramientas),
    enviar('/prestamos', prestamos),
    enviar('/', { proyectos }),
  ])

  if (!resHerramientas.ok) {
    throw new Error(`Error al sincronizar herramientas: ${resHerramientas.status}`)
  }
  if (!resPrestamos.ok) {
    throw new Error(`Error al sincronizar préstamos: ${resPrestamos.status}`)
  }
  if (!resProyectos.ok) {
    throw new Error(`Error al sincronizar proyectos: ${resProyectos.status}`)
  }
}