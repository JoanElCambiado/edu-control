import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { cerrarSesion, obtenerSesion } from '../services/session'
import './DashboardAdmin.css'

const SECCIONES = ['Catálogo de Herramientas', 'Préstamos'] as const
type Seccion = (typeof SECCIONES)[number]

function DashboardAdmin() {
  const sesion = obtenerSesion()
  const navigate = useNavigate()
  const [activa, setActiva] = useState<Seccion>('Catálogo de Herramientas')

  if (!sesion || sesion.rol !== 'ADMINISTRADOR') {
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
          {SECCIONES.map((seccion) => (
            <button
              key={seccion}
              type="button"
              className={`dashboard-nav-button${activa === seccion ? ' dashboard-nav-button--active' : ''}`}
              onClick={() => setActiva(seccion)}
            >
              {seccion}
            </button>
          ))}
          <button
            type="button"
            className="dashboard-nav-button dashboard-nav-button--danger"
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
        <h2 className="dashboard-title">{activa}</h2>
        <p className="dashboard-placeholder">Sección en construcción.</p>
      </main>
    </div>
  )
}

export default DashboardAdmin