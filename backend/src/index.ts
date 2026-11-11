import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { prisma } from './lib/prisma.js'
import usuariosRouter from './routes/usuarios.js'
import herramientasRouter from './routes/herramientas.js'
import prestamosRouter from './routes/prestamos.js'
import syncRouter from './routes/sync.js'
import { authJwt } from './middleware/authJwt.js'
import { firmarJwt } from './utils/jwt.js'
import { tokenizar } from './services/tokenVault.js'

const app = express()

app.use(cors())
app.use(express.json({ limit: '5mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/auth/login', async (req, res) => {
  const credencialRaw = req.body?.usuario ?? req.body?.documento ?? req.body?.credencial
  const contrasena = typeof req.body?.contrasena === 'string' ? req.body.contrasena : ''
  const credencial = typeof credencialRaw === 'string' ? credencialRaw.trim() : ''

  if (!credencial || !contrasena) {
    res.status(400).json({ error: 'Usuario/documento y contraseña son obligatorios' })
    return
  }

  let usuario = await prisma.usuario.findUnique({
    where: { documento: credencial },
  })

  if (!usuario) {
    usuario = await prisma.usuario.findFirst({
      where: { nombre: { equals: credencial, mode: 'insensitive' } },
    })
  }

  if (!usuario || usuario.contrasena !== contrasena) {
    res.status(401).json({ error: 'Credenciales incorrectas' })
    return
  }

  const documentoToken = tokenizar(usuario.documento)
  const token = firmarJwt({
    id: usuario.id,
    rol: usuario.rol,
    documento: documentoToken,
  })

  res.json({
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      documentoToken,
    },
  })
})

app.get('/api/sync/usuarios', authJwt, async (_req, res) => {
  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { prestamos: true } } },
  })
  res.json(usuarios)
})

app.use('/api/usuarios', authJwt, usuariosRouter)
app.use('/api/herramientas', authJwt, herramientasRouter)
app.use('/api/prestamos', authJwt, prestamosRouter)
app.use('/api/sync', authJwt, syncRouter)

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