import { Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../database/db'
import type { EstadoPrestamo } from '../database/models'
import { formatearFecha, useI18n } from '../i18n'
import { cerrarSesion, obtenerSesion } from '../services/session'
import './PanelUsuario.css'
import './DashboardAdmin.css'

const ETIQUETA_ESTADO: Record<EstadoPrestamo, string> = {
  prestado: 'Prestado',
  devuelto: 'Devuelto',
  atrasado: 'Atrasado',
}

type FilaHistorial = {
  id: string
  nombreHerramienta: string
  fechaSalida: number
  fechaDevolucion: number
  estado: EstadoPrestamo
}

function PanelUsuario() {
  const sesion = obtenerSesion()
  const navigate = useNavigate()
  const { t, locale, dir } = useI18n()
  const sesionId = sesion?.id

  const herramientasDisponibles = useLiveQuery(async () => {
    const todas = await db.herramientas.toArray()
    return todas
      .filter((herramienta) => herramienta.disponible && herramienta.cantidad > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [])

  const historial = useLiveQuery(async (): Promise<FilaHistorial[]> => {
    if (!sesionId) return []
    const prestamos = await db.prestamos.where('usuarioId').equals(sesionId).toArray()
    const herramientas = await db.herramientas.toArray()
    const nombres = new Map(herramientas.map((herramienta) => [herramienta.id, herramienta.nombre]))
    return prestamos
      .sort((a, b) => b.fechaSalida - a.fechaSalida)
      .map((prestamo) => ({
        id: prestamo.id,
        nombreHerramienta: nombres.get(prestamo.herramientaId) ?? 'Herramienta no encontrada',
        fechaSalida: prestamo.fechaSalida,
        fechaDevolucion: prestamo.fechaDevolucion,
        estado: prestamo.estado,
      }))
  }, [sesionId])

  if (!sesion || sesion.rol !== 'USUARIO') {
    return <Navigate to="/login" replace />
  }

  const handleCerrarSesion = () => {
    const acepta = window.confirm(t('auth.logoutConfirm'))
    if (!acepta) return
    cerrarSesion()
    navigate('/')
  }

  return (
    <div className="usuario" dir={dir}>
      <aside className="dashboard-sidebar">
        <h1 className="dashboard-brand">{t('auth.title')}</h1>
        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button dashboard-nav-button--danger"
            type="button"
            onClick={handleCerrarSesion}
          >
            {t('auth.logout')}
          </button>
        </nav>
        <p className="dashboard-user">
          {sesion.nombre} · {sesion.rol}
        </p>
      </aside>

      <main className="dashboard-content">
        <h2 className="dashboard-title">{t('inventory.title')}</h2>
        {herramientasDisponibles === undefined ? (
          <p className="usuario-placeholder">Cargando inventario…</p>
        ) : herramientasDisponibles.length === 0 ? (
          <p className="usuario-placeholder">{t('inventory.unitsCount', { count: 0 })}</p>
        ) : (
          <div className="usuario-grid">
            {herramientasDisponibles.map((herramienta) => (
              <article className="usuario-card" key={herramienta.id}>
                <h3 className="usuario-card-title">{herramienta.nombre}</h3>
                <p className="usuario-card-meta">{herramienta.categoria}</p>
                <p className="usuario-card-stock">
                  {t('inventory.unitsCount', { count: herramienta.cantidad })}
                </p>
              </article>
            ))}
          </div>
        )}

        <h2 className="dashboard-title usuario-historial-titulo">{t('loans.myHistory')}</h2>
        {historial === undefined ? (
          <p className="usuario-placeholder">Cargando historial…</p>
        ) : historial.length === 0 ? (
          <p className="usuario-placeholder">{t('loans.itemsCount', { count: 0 })}</p>
        ) : (
          <table className="usuario-tabla">
            <thead>
              <tr>
                <th>{t('inventory.title')}</th>
                <th>{t('loans.departureDate')}</th>
                <th>{t('loans.returnDate')}</th>
                <th>{t('inventory.status')}</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((registro) => (
                <tr key={registro.id}>
                  <td>{registro.nombreHerramienta}</td>
                  <td>{formatearFecha(registro.fechaSalida, locale)}</td>
                  <td>{formatearFecha(registro.fechaDevolucion, locale)}</td>
                  <td>
                    <span className={`usuario-estado usuario-estado--${registro.estado}`}>
                      {ETIQUETA_ESTADO[registro.estado]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}

export default PanelUsuario