import { Link, Navigate, useNavigate } from 'react-router-dom'
import { cerrarSesion, obtenerSesion } from '../services/session'
import './DashboardAdmin.css'

function DashboardRecepcion() {
  const sesion = obtenerSesion()
  const navigate = useNavigate()

  if (!sesion || (sesion.rol !== 'RECEPCION' && sesion.rol !== 'ADMINISTRADOR')) {
    return <Navigate to="/login" replace />
  }

  const handleCerrarSesion = () => {
    const acepta = window.confirm('¿Desea cerrar sesión?')
    if (!acepta) return
    cerrarSesion()
    navigate('/')
  }

  const hoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <h1 className="dashboard-brand">Edu Control</h1>
        <nav className="dashboard-nav">
          <Link className="dashboard-nav-button dashboard-nav-button--active" to="/nuevo-prestamo">
            Registrar Nuevo Préstamo
          </Link>
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
        <h2 className="dashboard-title">Módulo de Recepción</h2>
        <p className="dashboard-placeholder">{hoy}</p>
        <p className="dashboard-placeholder">
          Use «Registrar Nuevo Préstamo» para prestar una herramienta del catálogo.
        </p>
      </main>
    </div>
  )
}

export default DashboardRecepcion