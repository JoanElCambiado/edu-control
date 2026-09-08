import { Navigate, useNavigate } from 'react-router-dom'
import { cerrarSesion, obtenerSesion } from '../services/session'
import './ReportesAdmin.css'
import './DashboardAdmin.css'

function ReportesAdmin() {
  const sesion = obtenerSesion()
  const navigate = useNavigate()

  if (!sesion || sesion.rol !== 'ADMINISTRADOR') {
    return <Navigate to="/login" replace />
  }

  const handleCerrarSesion = () => {
    const acepta = window.confirm('¿Desea cerrar sesión?')
    if (!acepta) return
    cerrarSesion()
    navigate('/')
  }

  return (
    <div className="reportes">
      <aside className="dashboard-sidebar">
        <h1 className="dashboard-brand">Edu Control</h1>
        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() => navigate('/dashboard')}
          >
            Volver
          </button>
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
        <h2 className="dashboard-title">Reportes</h2>

        <div className="reportes-grid">
          <article className="reportes-card">
            <h3 className="reportes-card-title">Préstamos Activos</h3>
            <p className="reportes-card-valor">0</p>
            <p className="reportes-card-detalle">Préstamos en curso en este momento</p>
          </article>

          <article className="reportes-card">
            <h3 className="reportes-card-title">Herramientas más prestadas</h3>
            <p className="reportes-card-vacio">Sin datos por ahora</p>
          </article>

          <article className="reportes-card">
            <h3 className="reportes-card-title">Usuarios morosos</h3>
            <p className="reportes-card-vacio">Sin datos por ahora</p>
          </article>
        </div>
      </main>
    </div>
  )
}

export default ReportesAdmin