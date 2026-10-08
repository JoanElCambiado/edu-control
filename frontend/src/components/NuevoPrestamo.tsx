import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../database/db'
import type { Prestamo, Proyecto, Usuario } from '../database/models'
import { uuidv4 } from '../database/uuid'
import { cerrarSesion, obtenerSesion } from '../services/session'
import './NuevoPrestamo.css'

function NuevoPrestamo() {
  const sesion = obtenerSesion()
  const navigate = useNavigate()
  const [documentoRecibe, setDocumentoRecibe] = useState('')
  const [nombreRecibe, setNombreRecibe] = useState('')
  const [herramientaId, setHerramientaId] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [fechaDevolucion, setFechaDevolucion] = useState('')
  const [error, setError] = useState('')
  const [mostrarFormProyecto, setMostrarFormProyecto] = useState(false)
  const [nombreProyecto, setNombreProyecto] = useState('')
  const [errorProyecto, setErrorProyecto] = useState('')

  const herramientasDisponibles = useLiveQuery(async () => {
    const todas = await db.herramientas.toArray()
    return todas
      .filter((herramienta) => herramienta.disponible && herramienta.cantidad > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [])

  const proyectos = useLiveQuery(async () => {
    const todos = await db.proyectos.toArray()
    return todos.sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [])

  // Resuelve el titular por su clave natural mientras se escribe el documento.
  const usuarioEncontrado = useLiveQuery(async () => {
    const doc = documentoRecibe.trim()
    if (doc.length === 0) return null
    return (await db.usuarios.where('documento').equals(doc).first()) ?? null
  }, [documentoRecibe])

  const esAdministrador = sesion?.rol === 'ADMINISTRADOR'

  const ahora = new Date()
  const fechaMinima = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const herramienta = herramientasDisponibles?.find((h) => h.id === herramientaId)
    if (!herramienta) {
      setError('Selecciona una herramienta disponible')
      return
    }
    if (herramienta.cantidad <= 0) {
      setError('La herramienta seleccionada ya no tiene stock disponible')
      return
    }

    const documento = documentoRecibe.trim()
    if (documento.length === 0) {
      setError('Escribe el documento de quien recibe la herramienta')
      return
    }

    const nombre = nombreRecibe.trim()
    const marcaDeTiempo = Date.now()

    // UUID v4 generado ANTES de persistir (CONTEXTO.md, regla 3).
    const nuevoUsuarioId = uuidv4()
    const prestamoId = uuidv4()

    try {
      // Transaccion unica: usuario + prestamo + stock se comitean juntos o nada (RNF-04).
      await db.transaction('rw', db.usuarios, db.prestamos, db.herramientas, async () => {
        // Identificacion por clave natural exacta, nunca por nombre (§3.5).
        let usuario = (await db.usuarios.where('documento').equals(documento).first()) as
          | Usuario
          | undefined

        if (!usuario) {
          if (nombre.length === 0) {
            throw new Error(
              'El documento no está registrado. Escribe el nombre completo para crear el titular.',
            )
          }
          usuario = {
            id: nuevoUsuarioId,
            documento,
            nombre,
            rol: 'USUARIO',
            createdAt: marcaDeTiempo,
            updatedAt: marcaDeTiempo,
            syncStatus: 'pendiente',
            syncIntentos: 0,
          }
          await db.usuarios.add(usuario)
        } else if (nombre.length > 0 && nombre !== usuario.nombre) {
          // El documento manda: el nombre solo se corrige sobre el titular existente.
          await db.usuarios.update(usuario.id, {
            nombre,
            updatedAt: marcaDeTiempo,
            syncStatus: 'pendiente',
            syncIntentos: 0,
          })
        }

        const prestamo: Prestamo = {
          id: prestamoId,
          herramientaId: herramienta.id,
          // Unica referencia al receptor: `receptor` se eliminó por 3NF (§3.3).
          usuarioId: usuario.id,
          proyectoId: proyectoId || undefined,
          fechaSalida: marcaDeTiempo,
          fechaDevolucion: new Date(fechaDevolucion).getTime(),
          estado: 'prestado',
          createdAt: marcaDeTiempo,
          // Entra a la cola de sincronizacion de inmediato.
          syncStatus: 'pendiente',
          syncIntentos: 0,
        }

        await db.prestamos.add(prestamo)
        await db.herramientas.update(herramienta.id, {
          cantidad: herramienta.cantidad - 1,
          disponible: herramienta.cantidad - 1 > 0,
          updatedAt: marcaDeTiempo,
          syncStatus: 'pendiente',
          syncIntentos: 0,
        })
      })
    } catch (err) {
      console.error('Error al registrar el préstamo:', err)
      setError(err instanceof Error ? err.message : 'No se pudo registrar el préstamo')
      return
    }

    console.log('Préstamo registrado y encolado:', prestamoId)
    window.alert('Préstamo registrado correctamente')
    setDocumentoRecibe('')
    setNombreRecibe('')
    setHerramientaId('')
    setProyectoId('')
    setFechaDevolucion('')
  }

  const handleCerrarSesion = () => {
    const acepta = window.confirm('¿Desea cerrar sesión?')
    if (!acepta) return
    cerrarSesion()
    navigate('/')
  }

  const handleGuardarProyecto = async () => {
    const nombre = nombreProyecto.trim()
    if (!nombre) {
      setErrorProyecto('Escribe el nombre del proyecto')
      return
    }

    const proyecto: Proyecto = {
      id: uuidv4(),
      nombre,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pendiente',
      syncIntentos: 0,
    }

    await db.proyectos.add(proyecto)
    setProyectoId(proyecto.id)
    setNombreProyecto('')
    setErrorProyecto('')
    setMostrarFormProyecto(false)
  }

  const cargandoInventario = herramientasDisponibles === undefined

  return (
    <div className="prestamo">
      <aside className="dashboard-sidebar">
        <h1 className="dashboard-brand">Edu Control</h1>
        <nav className="dashboard-nav">
          {esAdministrador && (
            <button
              className="dashboard-nav-button"
              type="button"
              onClick={() => navigate('/dashboard')}
            >
              Volver
            </button>
          )}
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
            <label className="prestamo-label" htmlFor="prestamo-documento">
              Documento de quien recibe la herramienta
            </label>
            <input
              className="prestamo-input"
              id="prestamo-documento"
              name="documentoRecibe"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              required
              placeholder="Ej: 1070000003"
              value={documentoRecibe}
              onChange={(e) => {
                setDocumentoRecibe(e.target.value)
                if (error) setError('')
              }}
            />
            {usuarioEncontrado ? (
              <p className="prestamo-placeholder">
                Titular: <strong>{usuarioEncontrado.nombre}</strong>
              </p>
            ) : documentoRecibe.trim().length > 0 ? (
              <p className="prestamo-placeholder">
                Documento nuevo. Escribe el nombre para registrar al titular.
              </p>
            ) : null}
          </div>

          <div className="prestamo-field">
            <label className="prestamo-label" htmlFor="prestamo-nombre">
              Nombre completo {usuarioEncontrado ? '(opcional, para corregir)' : ''}
            </label>
            <input
              className="prestamo-input"
              id="prestamo-nombre"
              name="nombreRecibe"
              type="text"
              autoComplete="off"
              required={!usuarioEncontrado}
              placeholder={usuarioEncontrado?.nombre ?? 'Ej: Luis Pérez'}
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
                    {herramienta.nombre} - Disponibles: {herramienta.cantidad}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="prestamo-field">
            <div className="prestamo-field-row">
              <label className="prestamo-label" htmlFor="prestamo-proyecto">
                Proyecto Educativo
              </label>
              <button
                className="prestamo-mini-button"
                type="button"
                onClick={() => setMostrarFormProyecto((visible) => !visible)}
              >
                {mostrarFormProyecto ? 'Cancelar' : '+ Nuevo Proyecto'}
              </button>
            </div>
            {proyectos === undefined ? (
              <p className="prestamo-placeholder">Cargando proyectos…</p>
            ) : (
              <select
                className="prestamo-input"
                id="prestamo-proyecto"
                name="proyectoId"
                value={proyectoId}
                onChange={(e) => setProyectoId(e.target.value)}
              >
                <option value="">Sin proyecto</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>
                    {proyecto.nombre}
                  </option>
                ))}
              </select>
            )}

            {mostrarFormProyecto && (
              <div className="prestamo-subform">
                <input
                  className="prestamo-input"
                  id="prestamo-nuevo-proyecto"
                  name="nombreProyecto"
                  type="text"
                  autoComplete="off"
                  placeholder="Nombre del proyecto"
                  value={nombreProyecto}
                  onChange={(e) => {
                    setNombreProyecto(e.target.value)
                    if (errorProyecto) setErrorProyecto('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleGuardarProyecto()
                    }
                  }}
                />
                <button
                  className="prestamo-mini-button prestamo-mini-button--solid"
                  type="button"
                  onClick={handleGuardarProyecto}
                >
                  Guardar Proyecto
                </button>
                {errorProyecto && <p className="prestamo-error">{errorProyecto}</p>}
              </div>
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