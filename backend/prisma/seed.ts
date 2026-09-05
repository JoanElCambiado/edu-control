import { PrismaClient } from '@prisma/client'
import type { Rol } from '@prisma/client'

const prisma = new PrismaClient()

interface SeedUsuario {
  id: string
  nombre: string
  rol: Rol
  contrasena: string
}

const usuarios: SeedUsuario[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    nombre: 'Elena Torres',
    rol: 'ADMINISTRADOR',
    contrasena: '1234',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    nombre: 'Carlos Méndez',
    rol: 'RECEPCION',
    contrasena: '1234',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    nombre: 'Luis Pérez',
    rol: 'USUARIO',
    contrasena: '1234',
  },
]

async function main() {
  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { id: u.id },
      update: { nombre: u.nombre, rol: u.rol, contrasena: u.contrasena },
      create: { id: u.id, nombre: u.nombre, rol: u.rol, contrasena: u.contrasena },
    })
  }

  const total = await prisma.usuario.count()
  console.log(`Seed completado: ${usuarios.length} usuarios (${usuarios.map((u) => u.rol).join(', ')}). Total en BD: ${total}`)
}

main()
  .catch((err) => {
    console.error('Error en el seed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })