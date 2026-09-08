import { Navigate, useNavigate } from 'react-router-dom'
import { cerrarSesion, obtenerSesion } from '../services/session'
import './DashboardAdmin.css'

function DashboardRecepcion() {
  const sesion = obtenerSesion()
  const navigate = useNavigate()

  if (!sesion || (sesion.rol !== 'RECEPCION' && sesion.rol !== 'ADMINISTRADOR')) {
    return <Navigate to="/login" replace />
  }

  const handleCerrarSesion = () => {
    cerrarSesion()
    navigate('/login')
  }

  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <h1 className="dashboard-brand">Edu Control</h1>
        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button dashboard-nav-button--active"
            type="button"
            onClick={() => navigate('/prestamos/nuevo')}
          >
            Registrar Nuevo Préstamo
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
        <h2 className="dashboard-title">Módulo de Recepción</h2>
        <p className="dashboard-placeholder">Seleccione una opción del menú.</p>
      </main>
    </div>
  )
}

export default DashboardRecepcion