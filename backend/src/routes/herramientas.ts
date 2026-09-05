import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', async (_req, res) => {
  const herramientas = await prisma.herramienta.findMany({
    include: { _count: { select: { prestamos: true } } },
  })
  res.json(herramientas)
})

router.get('/:id', async (req, res) => {
  const herramienta = await prisma.herramienta.findUnique({
    where: { id: req.params.id },
    include: { prestamos: true },
  })
  if (!herramienta) {
    res.status(404).json({ error: 'Herramienta no encontrada' })
    return
  }
  res.json(herramienta)
})

router.post('/', async (req, res) => {
  const { nombre, descripcion, cantidad, disponible } = req.body
  if (typeof nombre !== 'string') {
    res.status(400).json({ error: 'nombre es obligatorio' })
    return
  }
  const herramienta = await prisma.herramienta.create({
    data: {
      nombre,
      descripcion,
      cantidad: typeof cantidad === 'number' ? cantidad : 1,
      disponible: typeof disponible === 'boolean' ? disponible : true,
    },
  })
  res.status(201).json(herramienta)
})

router.put('/:id', async (req, res) => {
  const { nombre, descripcion, cantidad, disponible } = req.body
  const herramienta = await prisma.herramienta.update({
    where: { id: req.params.id },
    data: {
      ...(nombre && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(typeof cantidad === 'number' && { cantidad }),
      ...(typeof disponible === 'boolean' && { disponible }),
    },
  })
  res.json(herramienta)
})

router.delete('/:id', async (req, res) => {
  await prisma.herramienta.delete({ where: { id: req.params.id } })
  res.status(204).end()
})

export default router