export type Rol = 'ADMINISTRADOR' | 'RECEPCION' | 'USUARIO'

export type EstadoPrestamo = 'prestado' | 'devuelto' | 'atrasado'

export interface Usuario {
  id: string
  nombre: string
  rol: Rol
  contrasena?: string
  createdAt: number
  updatedAt: number
}

export type EstadoFisico = 'excelente' | 'bueno' | 'regular' | 'mantenimiento'

export interface Herramienta {
  id: string
  nombre: string
  categoria: string
  estadoFisico: EstadoFisico
  cantidad: number
  disponible: boolean
  createdAt: number
  updatedAt: number
}

export interface Proyecto {
  id: string
  nombre: string
  descripcion?: string
  createdAt: number
  updatedAt: number
}

export interface Prestamo {
  id: string
  herramientaId: string
  usuarioId: string
  receptor: string
  proyectoId?: string
  fechaSalida: number
  fechaDevolucion: number
  fechaDevolucionReal?: number
  estado: EstadoPrestamo
  createdAt: number
}