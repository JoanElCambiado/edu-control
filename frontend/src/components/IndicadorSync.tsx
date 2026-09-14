import { useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { contarPendientes } from '../services/syncService'
import {
  forzarSync,
  obtenerEstadoSync,
  suscribirSync,
  type EstadoSync,
} from '../services/syncOrchestrator'
import './IndicadorSync.css'

const TEXTO: Record<EstadoSync, string> = {
  inactivo: 'Conectado',
  'sin-red': 'Sin conexion',
  sincronizando: 'Sincronizando...',
  ok: 'Datos al dia',
  error: 'Pendiente de enviar',
}

function IndicadorSync() {
  const estado = useSyncExternalStore(suscribirSync, obtenerEstadoSync, obtenerEstadoSync)

  // Conteo reactivo: el badge reacciona al instante cuando se guarda un prestamo offline.
  const pendientes = useLiveQuery(() => contarPendientes(), [], estado.pendientes)

  const sinRed = estado.estado === 'sin-red'

  return (
    <div className={`sync sync--${estado.estado}`} role="status" aria-live="polite">
      <span className="sync-punto" aria-hidden="true" />
      <span className="sync-texto">{TEXTO[estado.estado]}</span>

      {pendientes > 0 && <span className="sync-badge">{pendientes} sin enviar</span>}

      <button
        className="sync-boton"
        type="button"
        disabled={estado.estado === 'sincronizando' || sinRed}
        onClick={() => void forzarSync()}
        title={sinRed ? 'Se enviara automaticamente al volver la conexion' : estado.mensaje}
      >
        Enviar ahora
      </button>
    </div>
  )
}

export default IndicadorSync
