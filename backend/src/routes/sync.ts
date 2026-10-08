import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import type { EstadoPrestamo, Prisma, Rol } from '@prisma/client'

const ROLES: Rol[] = ['ADMINISTRADOR', 'RECEPCION', 'USUARIO']
const ESTADOS: EstadoPrestamo[] = ['prestado', 'devuelto', 'atrasado']

const router = Router()

interface SyncPayload {
  usuarios?: Array<{
    id: string
    documento: string
    nombre: string
    rol: Rol
    createdAt?: string | Date
    updatedAt?: string | Date
  }>
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
    fechaSalida?: string | number | Date
    fechaDevolucionEsperada?: string | number | Date
    fechaDevolucion?: string | number | Date
    fechaDevolucionReal?: string | number | Date | null
    estado?: EstadoPrestamo
    createdAt?: string | number | Date
  }>
}

const toDate = (value: string | number | Date | null | undefined) =>
  value === undefined || value === null ? undefined : new Date(value)

class SyncValidationError extends Error {}

interface SyncPrestamo {
  id: string
  herramientaId: string
  usuarioId: string
  proyectoId?: string | null
  fechaSalida?: string | number | Date
  fechaDevolucionEsperada?: string | number | Date
  fechaDevolucion?: string | number | Date
  fechaDevolucionReal?: string | number | Date | null
  estado?: EstadoPrestamo
  createdAt?: string | number | Date
}

const estadoValido = (estado: EstadoPrestamo | undefined): EstadoPrestamo => {
  if (estado !== undefined && ESTADOS.includes(estado)) {
    return estado
  }
  return 'prestado'
}

const prestamoParaActualizar = (p: SyncPrestamo, fechaDevolucionEsperada: Date) => ({
  herramientaId: p.herramientaId,
  usuarioId: p.usuarioId,
  proyectoId: p.proyectoId ?? null,
  fechaSalida: toDate(p.fechaSalida) ?? new Date(),
  fechaDevolucionEsperada,
  fechaDevolucionReal: toDate(p.fechaDevolucionReal) ?? null,
  estado: estadoValido(p.estado),
})

const prestamoParaCrear = (p: SyncPrestamo, fechaDevolucionEsperada: Date) => ({
  ...prestamoParaActualizar(p, fechaDevolucionEsperada),
  id: p.id,
  createdAt: toDate(p.createdAt) ?? new Date(),
})

/**
 * Valida que existan las dependencias del préstamo. Ya NO materializa usuarios
 * a partir de `receptor` (§3.3): el préstamo depende exclusivamente de `usuarioId`
 * y la cola garantiza que los usuarios se envían antes que los préstamos.
 */
async function asegurarDependenciasPrestamo(
  tx: Prisma.TransactionClient,
  prestamo: SyncPrestamo,
): Promise<Date> {
  const usuario = await tx.usuario.findUnique({
    where: { id: prestamo.usuarioId },
    select: { id: true },
  })
  if (!usuario) {
    throw new SyncValidationError(
      `Préstamo ${prestamo.id}: el usuario ${prestamo.usuarioId} no existe en la nube; sincronice primero los usuarios`,
    )
  }

  const herramienta = await tx.herramienta.findUnique({
    where: { id: prestamo.herramientaId },
    select: { id: true },
  })
  if (!herramienta) {
    throw new SyncValidationError(
      `Préstamo ${prestamo.id}: la herramienta ${prestamo.herramientaId} no existe en la nube; sincronice primero el catálogo`,
    )
  }

  if (prestamo.proyectoId) {
    const proyecto = await tx.proyecto.findUnique({
      where: { id: prestamo.proyectoId },
      select: { id: true },
    })
    if (!proyecto) {
      throw new SyncValidationError(
        `Préstamo ${prestamo.id}: el proyecto ${prestamo.proyectoId} no existe en la nube`,
      )
    }
  }

  return toDate(prestamo.fechaDevolucion ?? prestamo.fechaDevolucionEsperada) ?? new Date()
}

interface ResultadoLote {
  procesados: string[]
  rechazados: Array<{ id: string; motivo: string }>
}

const motivo = (error: unknown) =>
  error instanceof Error ? error.message : 'Error desconocido'

/**
 * Procesa cada prestamo en su propia transaccion: un registro invalido
 * ya no bloquea el lote completo (la cola del cliente avanza igual).
 */
async function procesarPrestamos(prestamos: SyncPrestamo[]): Promise<ResultadoLote> {
  const resultado: ResultadoLote = { procesados: [], rechazados: [] }

  for (const prestamo of prestamos) {
    try {
      await prisma.$transaction(async (tx) => {
        const fechaDevolucionEsperada = await asegurarDependenciasPrestamo(tx, prestamo)
        await tx.prestamo.upsert({
          where: { id: prestamo.id },
          update: prestamoParaActualizar(prestamo, fechaDevolucionEsperada),
          create: prestamoParaCrear(prestamo, fechaDevolucionEsperada),
        })
      })
      resultado.procesados.push(prestamo.id)
    } catch (error) {
      resultado.rechazados.push({ id: prestamo.id, motivo: motivo(error) })
    }
  }

  return resultado
}

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

  const resultado: ResultadoLote = { procesados: [], rechazados: [] }

  for (const h of payload) {
    try {
      await prisma.herramienta.upsert({
        where: { id: h.id },
        update: {
          nombre: h.nombre,
          categoria: h.categoria,
          estadoFisico: h.estadoFisico,
          cantidad: h.cantidad,
          disponible: h.disponible ?? true,
        },
        create: {
          id: h.id,
          nombre: h.nombre,
          categoria: h.categoria,
          estadoFisico: h.estadoFisico,
          cantidad: h.cantidad ?? 1,
          disponible: h.disponible ?? true,
          createdAt: toDate(h.createdAt) ?? new Date(),
        },
      })
      resultado.procesados.push(h.id)
    } catch (error) {
      resultado.rechazados.push({ id: h.id, motivo: motivo(error) })
    }
  }

  res.json(resultado)
})

router.post('/usuarios', async (req, res) => {
  const payload = req.body as NonNullable<SyncPayload['usuarios']>

  if (!Array.isArray(payload)) {
    res.status(400).json({ error: 'El body debe ser un array de usuarios' })
    return
  }

  const resultado: ResultadoLote = { procesados: [], rechazados: [] }

  for (const u of payload) {
    try {
      const rol = ROLES.includes(u.rol) ? u.rol : 'USUARIO'
      if (typeof u.documento !== 'string' || u.documento.trim().length === 0) {
        throw new Error('El documento es obligatorio y es la clave natural del usuario')
      }
      const documento = u.documento.trim()

      // Upsert por `documento` (clave natural) para que dos dispositivos que
      // registren a la misma persona offline converjan en un solo usuario (§3.5).
      const existentePorDocumento = await prisma.usuario.findUnique({
        where: { documento },
        select: { id: true },
      })

      if (existentePorDocumento && existentePorDocumento.id !== u.id) {
        await prisma.usuario.update({
          where: { documento },
          data: { nombre: u.nombre, rol },
        })
      } else {
        await prisma.usuario.upsert({
          where: { id: u.id },
          update: { documento, nombre: u.nombre, rol },
          create: {
            id: u.id,
            documento,
            nombre: u.nombre,
            rol,
            createdAt: toDate(u.createdAt) ?? new Date(),
          },
        })
      }
      resultado.procesados.push(u.id)
    } catch (error) {
      resultado.rechazados.push({ id: u.id, motivo: motivo(error) })
    }
  }

  res.json(resultado)
})

router.post('/proyectos', async (req, res) => {
  const payload = req.body as NonNullable<SyncPayload['proyectos']>

  if (!Array.isArray(payload)) {
    res.status(400).json({ error: 'El body debe ser un array de proyectos' })
    return
  }

  const resultado: ResultadoLote = { procesados: [], rechazados: [] }

  for (const p of payload) {
    try {
      await prisma.proyecto.upsert({
        where: { id: p.id },
        update: { nombre: p.nombre, descripcion: p.descripcion },
        create: {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          createdAt: toDate(p.createdAt) ?? new Date(),
        },
      })
      resultado.procesados.push(p.id)
    } catch (error) {
      resultado.rechazados.push({ id: p.id, motivo: motivo(error) })
    }
  }

  res.json(resultado)
})

router.post('/prestamos', async (req, res) => {
  const payload = req.body as SyncPrestamo[]

  if (!Array.isArray(payload)) {
    res.status(400).json({ error: 'El body debe ser un array de préstamos' })
    return
  }

  res.json(await procesarPrestamos(payload))
})

router.post('/', async (req, res) => {
  const payload = req.body as SyncPayload

  const usuarios = await prisma.$transaction(
    (payload.usuarios ?? []).map((u) =>
      prisma.usuario.upsert({
        where: { documento: u.documento },
        update: {
          nombre: u.nombre,
          rol: ROLES.includes(u.rol) ? u.rol : 'USUARIO',
        },
        create: {
          id: u.id,
          documento: u.documento,
          nombre: u.nombre,
          rol: ROLES.includes(u.rol) ? u.rol : 'USUARIO',
          createdAt: toDate(u.createdAt) ?? new Date(),
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

  const resultadoPrestamos = await procesarPrestamos((payload.prestamos ?? []) as SyncPrestamo[])

  res.json({
    usuarios: usuarios.length,
    herramientas: herramientas.length,
    proyectos: proyectos.length,
    prestamos: resultadoPrestamos.procesados.length,
    rechazados: resultadoPrestamos.rechazados,
  })
})

export default router