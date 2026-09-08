import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../database/db'
import type { Prestamo, Usuario } from '../database/models'
import { uuidv4 } from '../database/uuid'
import { cerrarSesion, obtenerSesion } from '../services/session'
import './NuevoPrestamo.css'

function NuevoPrestamo() {
  const sesion = obtenerSesion()
  const navigate = useNavigate()
  const [nombreRecibe, setNombreRecibe] = useState('')
  const [herramientaId, setHerramientaId] = useState('')
  const [fechaDevolucion, setFechaDevolucion] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const herramientasDisponibles = useLiveQuery(async () => {
    const todas = await db.herramientas.toArray()
    return todas
      .filter((herramienta) => herramienta.disponible)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [])

  const destinoVolver = sesion && sesion.rol === 'ADMINISTRADOR' ? '/dashboard' : '/recepcion'

  const ahora = new Date()
  const fechaMinima = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMensaje('')

    const herramienta = herramientasDisponibles?.find((h) => h.id === herramientaId)
    if (!herramienta) {
      setError('Selecciona una herramienta disponible')
      return
    }

    const nombre = nombreRecibe.trim()
    let usuario = (await db.usuarios.where('nombre').equals(nombre).first()) as Usuario | undefined
    if (!usuario) {
      usuario = {
        id: uuidv4(),
        nombre,
        rol: 'USUARIO',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.usuarios.add(usuario)
    }

    const marcaDeTiempo = Date.now()
    const prestamo: Prestamo = {
      id: uuidv4(),
      herramientaId: herramienta.id,
      usuarioId: usuario.id,
      fechaSalida: marcaDeTiempo,
      fechaDevolucionEsperada: new Date(fechaDevolucion).getTime(),
      estado: 'prestado',
      createdAt: marcaDeTiempo,
    }

    await db.prestamos.add(prestamo)
    await db.herramientas.update(herramienta.id, { disponible: false, updatedAt: marcaDeTiempo })

    console.log('Préstamo registrado:', prestamo)
    setMensaje(`Préstamo registrado: ${herramienta.nombre} para ${nombre}`)
    setNombreRecibe('')
    setHerramientaId('')
    setFechaDevolucion('')
  }

  const handleCerrarSesion = () => {
    const acepta = window.confirm('¿Desea cerrar sesión?')
    if (!acepta) return
    cerrarSesion()
    navigate('/')
  }

  const cargandoInventario = herramientasDisponibles === undefined

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
            <label className="prestamo-label" htmlFor="prestamo-herramienta">
              Herramienta
            </label>
            {cargandoInventario ? (
              <p className="prestamo-placeholder">Cargando inventario…</p>
            ) : herramientasDisponibles.length === 0 ? (
              <p className="prestamo-placeholder">
                No hay herramientas disponibles para prestar.
              </p>
            ) : (
              <select
                className="prestamo-input"
                id="prestamo-herramienta"
                name="herramientaId"
                required
                value={herramientaId}
                onChange={(e) => setHerramientaId(e.target.value)}
              >
                <option value="" disabled>
                  Seleccione una herramienta
                </option>
                {herramientasDisponibles.map((herramienta) => (
                  <option key={herramienta.id} value={herramienta.id}>
                    {herramienta.nombre} — {herramienta.categoria}
                  </option>
                ))}
              </select>
            )}
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
              min={fechaMinima}
              required
              value={fechaDevolucion}
              onChange={(e) => setFechaDevolucion(e.target.value)}
            />
          </div>

          {error && <p className="prestamo-error">{error}</p>}
          {mensaje && <p className="prestamo-success">{mensaje}</p>}

          <button
            className="prestamo-button"
            type="submit"
            disabled={herramientasDisponibles?.length === 0}
          >
            Guardar Préstamo
          </button>
        </form>
      </main>
    </div>
  )
}

export default NuevoPrestamo