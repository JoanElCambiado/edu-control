import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import type { EstadoPrestamo, Rol } from '@prisma/client'

const ROLES: Rol[] = ['ADMINISTRADOR', 'RECEPCION', 'USUARIO']
const ESTADOS: EstadoPrestamo[] = ['prestado', 'devuelto', 'atrasado']

const router = Router()

interface SyncPayload {
  usuarios?: Array<{ id: string; nombre: string; rol: Rol; createdAt?: string | Date; updatedAt?: string | Date }>
  herramientas?: Array<{
    id: string
    nombre: string
    categoria?: string
    estadoFisico?: string
    descripcion?: string | null
    cantidad: number
    disponible?: boolean
    createdAt?: string | Date
    updatedAt?: string | Date
  }>
  proyectos?: Array<{
    id: string
    nombre: string
    descripcion?: string | null
    createdAt?: string | Date
    updatedAt?: string | Date
  }>
  prestamos?: Array<{
    id: string
    herramientaId: string
    usuarioId: string
    proyectoId?: string | null
    fechaSalida?: string | Date
    fechaDevolucionEsperada: string | Date
    fechaDevolucionReal?: string | Date | null
    estado?: EstadoPrestamo
    createdAt?: string | Date
  }>
}

const toDate = (value: string | Date | null | undefined) =>
  value === undefined || value === null ? undefined : new Date(value)

interface SyncHerramienta {
  id: string
  nombre: string
  categoria: string
  estadoFisico: string
  cantidad: number
  disponible?: boolean
  createdAt?: string | Date
  updatedAt?: string | Date
}

router.get('/herramientas', async (_req, res) => {
  const herramientas = await prisma.herramienta.findMany({
    orderBy: { createdAt: 'asc' },
  })
  res.json(herramientas)
})

router.post('/herramientas', async (req, res) => {
  const payload = req.body as SyncHerramienta[]

  if (!Array.isArray(payload)) {
    res.status(400).json({ error: 'El body debe ser un array de herramientas' })
    return
  }

  const herramientas = await prisma.$transaction(
    payload.map((h) =>
      prisma.herramienta.upsert({
        where: { id: h.id },
        update: {
          nombre: h.nombre,
          categoria: h.categoria,
          estadoFisico: h.estadoFisico,
          cantidad: h.cantidad,
          disponible: h.disponible ?? true,
          updatedAt: toDate(h.updatedAt) ?? new Date(),
        },
        create: {
          id: h.id,
          nombre: h.nombre,
          categoria: h.categoria,
          estadoFisico: h.estadoFisico,
          cantidad: h.cantidad ?? 1,
          disponible: h.disponible ?? true,
          createdAt: toDate(h.createdAt) ?? new Date(),
          updatedAt: toDate(h.updatedAt) ?? new Date(),
        },
      }),
    ),
  )

  res.json({ herramientas: herramientas.length })
})

router.post('/', async (req, res) => {
  const payload = req.body as SyncPayload

  const usuarios = await prisma.$transaction(
    (payload.usuarios ?? []).map((u) =>
      prisma.usuario.upsert({
        where: { id: u.id },
        update: {
          nombre: u.nombre,
          rol: ROLES.includes(u.rol) ? u.rol : 'USUARIO',
          updatedAt: toDate(u.updatedAt) ?? new Date(),
        },
        create: {
          id: u.id,
          nombre: u.nombre,
          rol: ROLES.includes(u.rol) ? u.rol : 'USUARIO',
          createdAt: toDate(u.createdAt) ?? new Date(),
          updatedAt: toDate(u.updatedAt) ?? new Date(),
        },
      }),
    ),
  )

  const herramientas = await prisma.$transaction(
    (payload.herramientas ?? []).map((h) =>
      prisma.herramienta.upsert({
        where: { id: h.id },
        update: {
          nombre: h.nombre,
          categoria: h.categoria ?? 'General',
          estadoFisico: h.estadoFisico ?? 'bueno',
          descripcion: h.descripcion,
          cantidad: h.cantidad,
          disponible: h.disponible ?? true,
          updatedAt: toDate(h.updatedAt) ?? new Date(),
        },
        create: {
          id: h.id,
          nombre: h.nombre,
          categoria: h.categoria ?? 'General',
          estadoFisico: h.estadoFisico ?? 'bueno',
          descripcion: h.descripcion,
          cantidad: h.cantidad ?? 1,
          disponible: h.disponible ?? true,
          createdAt: toDate(h.createdAt) ?? new Date(),
          updatedAt: toDate(h.updatedAt) ?? new Date(),
        },
      }),
    ),
  )

  const proyectos = await prisma.$transaction(
    (payload.proyectos ?? []).map((p) =>
      prisma.proyecto.upsert({
        where: { id: p.id },
        update: {
          nombre: p.nombre,
          descripcion: p.descripcion,
          updatedAt: toDate(p.updatedAt) ?? new Date(),
        },
        create: {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          createdAt: toDate(p.createdAt) ?? new Date(),
          updatedAt: toDate(p.updatedAt) ?? new Date(),
        },
      }),
    ),
  )

  const prestamos = await prisma.$transaction(
    (payload.prestamos ?? []).map((p) =>
      prisma.prestamo.upsert({
        where: { id: p.id },
        update: {
          herramientaId: p.herramientaId,
          usuarioId: p.usuarioId,
          proyectoId: p.proyectoId ?? null,
          fechaSalida: toDate(p.fechaSalida) ?? new Date(),
          fechaDevolucionEsperada: toDate(p.fechaDevolucionEsperada) ?? new Date(),
          fechaDevolucionReal: toDate(p.fechaDevolucionReal) ?? null,
          estado: ESTADOS.includes(p.estado ?? 'prestado') ? p.estado! : 'prestado',
        },
        create: {
          id: p.id,
          herramientaId: p.herramientaId,
          usuarioId: p.usuarioId,
          proyectoId: p.proyectoId ?? null,
          fechaSalida: toDate(p.fechaSalida) ?? new Date(),
          fechaDevolucionEsperada: toDate(p.fechaDevolucionEsperada) ?? new Date(),
          fechaDevolucionReal: toDate(p.fechaDevolucionReal) ?? null,
          estado: ESTADOS.includes(p.estado ?? 'prestado') ? p.estado! : 'prestado',
          createdAt: toDate(p.createdAt) ?? new Date(),
        },
      }),
    ),
  )

  res.json({
    usuarios: usuarios.length,
    herramientas: herramientas.length,
    proyectos: proyectos.length,
    prestamos: prestamos.length,
  })
})

export default router