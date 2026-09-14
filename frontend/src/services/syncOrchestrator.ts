import { contarPendientes, hayRed, sincronizarDatos } from './syncService'

export type EstadoSync = 'inactivo' | 'sin-red' | 'sincronizando' | 'ok' | 'error'

export interface EstadoOrquestador {
  estado: EstadoSync
  pendientes: number
  ultimoIntento: number | null
  mensaje: string
}

const INTERVALO_BASE = 60_000
const ESPERA_MAXIMA = 15 * 60_000

let estadoActual: EstadoOrquestador = {
  estado: hayRed() ? 'inactivo' : 'sin-red',
  pendientes: 0,
  ultimoIntento: null,
  mensaje: '',
}

const suscriptores = new Set<() => void>()
let enEjecucion = false
let fallosConsecutivos = 0
let temporizador: ReturnType<typeof setTimeout> | undefined
let iniciado = false

function notificar(parcial: Partial<EstadoOrquestador>): void {
  estadoActual = { ...estadoActual, ...parcial }
  for (const cb of suscriptores) cb()
}

export function suscribirSync(cb: () => void): () => void {
  suscriptores.add(cb)
  return () => {
    suscriptores.delete(cb)
  }
}

export function obtenerEstadoSync(): EstadoOrquestador {
  return estadoActual
}

function backoff(): number {
  return Math.min(INTERVALO_BASE * 2 ** fallosConsecutivos, ESPERA_MAXIMA)
}

function programar(ms: number): void {
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(() => void ejecutarCiclo(), ms)
}

export async function ejecutarCiclo(): Promise<void> {
  if (enEjecucion) return
  enEjecucion = true

  try {
    if (!hayRed()) {
      notificar({
        estado: 'sin-red',
        pendientes: await contarPendientes().catch(() => estadoActual.pendientes),
        mensaje: 'Trabajando sin conexion',
      })
      return
    }

    const pendientesPrevios = await contarPendientes()

    notificar({
      estado: 'sincronizando',
      pendientes: pendientesPrevios,
      mensaje: pendientesPrevios > 0 ? 'Enviando datos' : 'Actualizando catalogos',
    })

    // Siempre se ejecuta el ciclo completo (pull + push), incluso sin pendientes:
    // el pull de usuarios es lo que habilita el login offline en un dispositivo nuevo.
    const resultado = await sincronizarDatos()
    fallosConsecutivos = 0

    notificar({
      estado: resultado.rechazados > 0 ? 'error' : 'ok',
      pendientes: await contarPendientes(),
      ultimoIntento: Date.now(),
      mensaje:
        resultado.rechazados > 0
          ? `${resultado.enviados} enviados, ${resultado.rechazados} con error`
          : pendientesPrevios === 0
            ? 'Todo sincronizado'
            : `${resultado.enviados} registros sincronizados`,
    })
  } catch (err) {
    fallosConsecutivos += 1
    notificar({
      estado: 'error',
      pendientes: await contarPendientes().catch(() => estadoActual.pendientes),
      ultimoIntento: Date.now(),
      mensaje: err instanceof Error ? err.message : 'Error de sincronizacion',
    })
  } finally {
    enEjecucion = false
    programar(fallosConsecutivos > 0 ? backoff() : INTERVALO_BASE)
  }
}

export function forzarSync(): Promise<void> {
  fallosConsecutivos = 0
  return ejecutarCiclo()
}

/** Arranca la escucha de red + polling de respaldo. Devuelve el limpiador. */
export function iniciarOrquestador(): () => void {
  if (iniciado) return () => undefined
  iniciado = true

  const alConectar = () => {
    fallosConsecutivos = 0
    // Feedback inmediato antes de tocar IndexedDB o la red.
    notificar({ estado: 'sincronizando', mensaje: 'Conexion restaurada, enviando datos' })
    void ejecutarCiclo()
  }

  const alDesconectar = () => {
    // Notificar SINCRONAMENTE: no depender de una promesa de Dexie para re-renderizar.
    notificar({ estado: 'sin-red', mensaje: 'Trabajando sin conexion' })
    void contarPendientes()
      .then((pendientes) => notificar({ pendientes }))
      .catch(() => undefined)
  }

  const alVolverAlFoco = () => {
    if (document.visibilityState === 'visible' && hayRed()) void ejecutarCiclo()
  }

  window.addEventListener('online', alConectar)
  window.addEventListener('offline', alDesconectar)
  document.addEventListener('visibilitychange', alVolverAlFoco)

  void ejecutarCiclo()

  return () => {
    window.removeEventListener('online', alConectar)
    window.removeEventListener('offline', alDesconectar)
    document.removeEventListener('visibilitychange', alVolverAlFoco)
    if (temporizador) clearTimeout(temporizador)
    iniciado = false
  }
}
