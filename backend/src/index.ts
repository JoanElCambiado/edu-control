import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { prisma } from './lib/prisma.js'
import usuariosRouter from './routes/usuarios.js'
import herramientasRouter from './routes/herramientas.js'
import prestamosRouter from './routes/prestamos.js'
import syncRouter from './routes/sync.js'

async function seed() {
  const admin = await prisma.usuario.findFirst({ where: { rol: 'ADMINISTRADOR' } })
  if (admin) return
  const created = await prisma.usuario.create({
    data: { nombre: 'Administrador', rol: 'ADMINISTRADOR' },
  })
  console.log(`Seed: usuario administrador creado (${created.id})`)
}

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/sync/usuarios', async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { prestamos: true } } },
  })
  res.json(usuarios)
})

app.use('/api/usuarios', usuariosRouter)
app.use('/api/herramientas', herramientasRouter)
app.use('/api/prestamos', prestamosRouter)
app.use('/api/sync', syncRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  },
)

const port = Number(process.env.PORT ?? 4000)

async function main() {
  await seed()
  app.listen(port, () => {
    console.log(`API escuchando en http://localhost:${port}`)
  })
}

main().catch(async (err) => {
  console.error('No se pudo iniciar el servidor:', err)
  await prisma.$disconnect()
  process.exit(1)
})

async function shutdown() {
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)