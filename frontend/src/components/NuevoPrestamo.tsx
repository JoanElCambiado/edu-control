import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { cerrarSesion, obtenerSesion } from '../services/session'
import './NuevoPrestamo.css'

function NuevoPrestamo() {
  const sesion = obtenerSesion()
  const navigate = useNavigate()
  const [nombreRecibe, setNombreRecibe] = useState('')
  const [fechaDevolucion, setFechaDevolucion] = useState('')

  const destinoVolver = sesion && sesion.rol === 'ADMINISTRADOR' ? '/dashboard' : '/recepcion'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    console.log({ nombreRecibe, fechaDevolucion })
  }

  const handleCerrarSesion = () => {
    cerrarSesion()
    navigate('/login')
  }

  return (
    <div className="prestamo">
      <aside className="dashboard-sidebar">
        <h1 className="dashboard-brand">Edu Control</h1>
        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() => navigate(destinoVolver)}
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
          {sesion?.nombre} · {sesion?.rol}
        </p>
      </aside>

      <main className="dashboard-content">
        <h2 className="dashboard-title">Registrar Nuevo Préstamo</h2>

        <form className="prestamo-form" onSubmit={handleSubmit}>
          <div className="prestamo-field">
            <label className="prestamo-label" htmlFor="prestamo-nombre">
              Nombre de quien recibe la herramienta
            </label>
            <input
              className="prestamo-input"
              id="prestamo-nombre"
              name="nombreRecibe"
              type="text"
              autoComplete="off"
              required
              value={nombreRecibe}
              onChange={(e) => setNombreRecibe(e.target.value)}
            />
          </div>

          <div className="prestamo-field">
            <label className="prestamo-label" htmlFor="prestamo-fecha">
              Fecha de devolución
            </label>
            <input
              className="prestamo-input"
              id="prestamo-fecha"
              name="fechaDevolucion"
              type="date"
              required
              value={fechaDevolucion}
              onChange={(e) => setFechaDevolucion(e.target.value)}
            />
          </div>

          <button className="prestamo-button" type="submit">
            Guardar Préstamo
          </button>
        </form>
      </main>
    </div>
  )
}

export default NuevoPrestamo