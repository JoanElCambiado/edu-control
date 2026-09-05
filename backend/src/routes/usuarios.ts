import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import type { Rol } from '@prisma/client'

const ROLES: Rol[] = ['ADMINISTRADOR', 'RECEPCION', 'USUARIO']
const router = Router()

const isRol = (value: unknown): value is Rol => typeof value === 'string' && ROLES.includes(value as Rol)

router.get('/', async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    include: { _count: { select: { prestamos: true } } },
  })
  res.json(usuarios)
})

router.get('/:id', async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.params.id },
    include: { prestamos: true },
  })
  if (!usuario) {
    res.status(404).json({ error: 'Usuario no encontrado' })
    return
  }
  res.json(usuario)
})

router.post('/', async (req, res) => {
  const { nombre, rol } = req.body
  if (typeof nombre !== 'string' || !isRol(rol)) {
    res.status(400).json({ error: 'nombre y rol (ADMINISTRADOR | RECEPCION | USUARIO) son obligatorios' })
    return
  }
  const usuario = await prisma.usuario.create({ data: { nombre, rol } })
  res.status(201).json(usuario)
})

router.put('/:id', async (req, res) => {
  const { nombre, rol } = req.body
  const usuario = await prisma.usuario.update({
    where: { id: req.params.id },
    data: {
      ...(typeof nombre === 'string' && { nombre }),
      ...(isRol(rol) && { rol }),
    },
  })
  res.json(usuario)
})

router.delete('/:id', async (req, res) => {
  await prisma.usuario.delete({ where: { id: req.params.id } })
  res.status(204).end()
})

export default router