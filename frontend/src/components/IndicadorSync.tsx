import { useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { contarPrestamosPendientes } from '../services/syncService'
import { forzarSync, obtenerEstadoSync, suscribirSync } from '../services/syncOrchestrator'
import './IndicadorSync.css'

/**
 * Estado de red suscrito DIRECTAMENTE a los eventos online/offline del navegador.
 * useSyncExternalStore relee el snapshot en cada notificacion: re-render inmediato
 * y sin depender de visibilitychange ni del orquestador.
 */
function suscribirRed(alCambiar: () => void): () => void {
  window.addEventListener('online', alCambiar)
  window.addEventListener('offline', alCambiar)
  return () => {
    window.removeEventListener('online', alCambiar)
    window.removeEventListener('offline', alCambiar)
  }
}

const leerRed = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

function IndicadorSync() {
  const enLinea = useSyncExternalStore(suscribirRed, leerRed, () => true)
  const orquestador = useSyncExternalStore(suscribirSync, obtenerEstadoSync, obtenerEstadoSync)

  // Badge: UNICAMENTE prestamos con syncStatus 'pendiente'.
  const prestamosPendientes = useLiveQuery(() => contarPrestamosPendientes(), [], 0)

  const sincronizando = enLinea && orquestador.estado === 'sincronizando'

  let texto: string
  if (!enLinea) {
    texto = 'Sin conexión'
  } else if (sincronizando) {
    texto = 'Sincronizando...'
  } else if (prestamosPendientes > 0) {
    texto = 'Pendiente de enviar'
  } else {
    texto = 'Datos al día'
  }

  const variante = !enLinea
    ? 'sin-red'
    : sincronizando
      ? 'sincronizando'
      : prestamosPendientes > 0
        ? 'error'
        : 'ok'

  return (
    <div className={`sync sync--${variante}`} role="status" aria-live="polite">
      <span className="sync-punto" aria-hidden="true" />
      <span className="sync-texto">{texto}</span>

      {prestamosPendientes > 0 && (
        <span className="sync-badge">
          {prestamosPendientes} {prestamosPendientes === 1 ? 'préstamo' : 'préstamos'} sin enviar
        </span>
      )}

      <button
        className="sync-boton"
        type="button"
        disabled={!enLinea || sincronizando}
        onClick={() => void forzarSync()}
        title={
          enLinea ? orquestador.mensaje : 'Se enviará automáticamente al volver la conexión'
        }
      >
        Enviar ahora
      </button>
    </div>
  )
}

export default IndicadorSync
