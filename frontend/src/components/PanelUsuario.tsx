import { Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../database/db'
import type { EstadoPrestamo } from '../database/models'
import { cerrarSesion, obtenerSesion } from '../services/session'
import './PanelUsuario.css'
import './DashboardAdmin.css'

const ETIQUETA_ESTADO: Record<EstadoPrestamo, string> = {
  prestado: 'Prestado',
  devuelto: 'Devuelto',
  atrasado: 'Atrasado',
}

function formatearFecha(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

type FilaHistorial = {
  id: string
  nombreHerramienta: string
  fechaSalida: number
  estado: EstadoPrestamo
}

function PanelUsuario() {
  const sesion = obtenerSesion()
  const navigate = useNavigate()
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
        estado: prestamo.estado,
      }))
  }, [sesionId])

  if (!sesion || sesion.rol !== 'USUARIO') {
    return <Navigate to="/login" replace />
  }

  const handleCerrarSesion = () => {
    const acepta = window.confirm('¿Desea cerrar sesión?')
    if (!acepta) return
    cerrarSesion()
    navigate('/')
  }

  return (
    <div className="usuario">
      <aside className="dashboard-sidebar">
        <h1 className="dashboard-brand">Edu Control</h1>
        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button dashboard-nav-button--danger"
            type="button"
            onClick={handleCerrarSesion}
          >
            Cerrar Sesión
          </button>
        </nav>
        <p className="dashboard-user">
          {sesion.nombre} · {sesion.rol}
        </p>
      </aside>

      <main className="dashboard-content">
        <h2 className="dashboard-title">Herramientas Disponibles</h2>
        {herramientasDisponibles === undefined ? (
          <p className="usuario-placeholder">Cargando inventario…</p>
        ) : herramientasDisponibles.length === 0 ? (
          <p className="usuario-placeholder">No hay herramientas disponibles en este momento.</p>
        ) : (
          <div className="usuario-grid">
            {herramientasDisponibles.map((herramienta) => (
              <article className="usuario-card" key={herramienta.id}>
                <h3 className="usuario-card-title">{herramienta.nombre}</h3>
                <p className="usuario-card-meta">{herramienta.categoria}</p>
                <p className="usuario-card-stock">Disponibles: {herramienta.cantidad}</p>
              </article>
            ))}
          </div>
        )}

        <h2 className="dashboard-title usuario-historial-titulo">Mi Historial</h2>
        {historial === undefined ? (
          <p className="usuario-placeholder">Cargando historial…</p>
        ) : historial.length === 0 ? (
          <p className="usuario-placeholder">Todavía no tienes préstamos registrados.</p>
        ) : (
          <table className="usuario-tabla">
            <thead>
              <tr>
                <th>Herramienta</th>
                <th>Fecha de entrega</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((registro) => (
                <tr key={registro.id}>
                  <td>{registro.nombreHerramienta}</td>
                  <td>{formatearFecha(registro.fechaSalida)}</td>
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