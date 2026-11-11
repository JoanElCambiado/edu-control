import { useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useI18n } from '../i18n'
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
  const { t, dir } = useI18n()
  const enLinea = useSyncExternalStore(suscribirRed, leerRed, () => true)
  const orquestador = useSyncExternalStore(suscribirSync, obtenerEstadoSync, obtenerEstadoSync)

  // Badge: UNICAMENTE prestamos con syncStatus 'pendiente'.
  const prestamosPendientes = useLiveQuery(() => contarPrestamosPendientes(), [], 0)

  const sincronizando = enLinea && orquestador.estado === 'sincronizando'

  let texto: string
  if (!enLinea) {
    texto = t('sync.offline')
  } else if (sincronizando) {
    texto = t('sync.syncing')
  } else if (prestamosPendientes > 0) {
    texto = t('sync.pendingSend')
  } else {
    texto = t('sync.onlineUpToDate')
  }

  const variante = !enLinea
    ? 'sin-red'
    : sincronizando
      ? 'sincronizando'
      : prestamosPendientes > 0
        ? 'error'
        : 'ok'

  return (
    <div className={`sync sync--${variante}`} dir={dir} role="status" aria-live="polite">
      <span className="sync-punto" aria-hidden="true" />
      <span className="sync-texto">{texto}</span>

      {prestamosPendientes > 0 && (
        <span className="sync-badge">
          {t('loans.pendingCount', { count: prestamosPendientes })}
        </span>
      )}

      <button
        className="sync-boton"
        type="button"
        disabled={!enLinea || sincronizando}
        onClick={() => void forzarSync()}
        title={enLinea ? orquestador.mensaje : t('sync.autoSendHint')}
      >
        {t('sync.sendNow')}
      </button>
    </div>
  )
}

export default IndicadorSync
