import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', async (_req, res) => {
  const prestamos = await prisma.prestamo.findMany({
    include: { herramienta: true, usuario: true, proyecto: true },
    orderBy: { fechaSalida: 'desc' },
  })
  res.json(prestamos)
})

router.get('/:id', async (req, res) => {
  const prestamo = await prisma.prestamo.findUnique({
    where: { id: req.params.id },
    include: { herramienta: true, usuario: true, proyecto: true },
  })
  if (!prestamo) {
    res.status(404).json({ error: 'Préstamo no encontrado' })
    return
  }
  res.json(prestamo)
})

router.post('/', async (req, res) => {
  const { herramientaId, usuarioId, proyectoId, fechaSalida, fechaDevolucionEsperada, estado } = req.body
  if (typeof herramientaId !== 'string' || typeof usuarioId !== 'string') {
    res.status(400).json({ error: 'herramientaId y usuarioId son obligatorios' })
    return
  }
  if (!fechaDevolucionEsperada) {
    res.status(400).json({ error: 'fechaDevolucionEsperada es obligatoria' })
    return
  }
  const prestamo = await prisma.prestamo.create({
    data: {
      herramientaId,
      usuarioId,
      proyectoId: typeof proyectoId === 'string' ? proyectoId : null,
      fechaSalida: fechaSalida ? new Date(fechaSalida) : new Date(),
      fechaDevolucionEsperada: new Date(fechaDevolucionEsperada),
      estado,
    },
    include: { herramienta: true, usuario: true, proyecto: true },
  })
  res.status(201).json(prestamo)
})

router.put('/:id', async (req, res) => {
  const { proyectoId, fechaSalida, fechaDevolucionEsperada, fechaDevolucionReal, estado } = req.body
  const prestamo = await prisma.prestamo.update({
    where: { id: req.params.id },
    data: {
      ...(proyectoId !== undefined && { proyectoId }),
      ...(fechaSalida && { fechaSalida: new Date(fechaSalida) }),
      ...(fechaDevolucionEsperada && { fechaDevolucionEsperada: new Date(fechaDevolucionEsperada) }),
      ...(fechaDevolucionReal !== undefined && {
        fechaDevolucionReal: fechaDevolucionReal ? new Date(fechaDevolucionReal) : null,
      }),
      ...(estado && { estado }),
    },
    include: { herramienta: true, usuario: true, proyecto: true },
  })
  res.json(prestamo)
})

router.delete('/:id', async (req, res) => {
  await prisma.prestamo.delete({ where: { id: req.params.id } })
  res.status(204).end()
})

export default router