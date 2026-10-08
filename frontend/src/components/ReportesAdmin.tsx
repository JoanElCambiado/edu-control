import { Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../database/db'
import { cerrarSesion, obtenerSesion } from '../services/session'
import './ReportesAdmin.css'
import './DashboardAdmin.css'

const LIMITE_MOROSOS = 5

function ReportesAdmin() {
  const sesion = obtenerSesion()
  const navigate = useNavigate()

  const reporte = useLiveQuery(async () => {
    const [prestamos, herramientas, usuarios] = await Promise.all([
      db.prestamos.toArray(),
      db.herramientas.toArray(),
      db.usuarios.toArray(),
    ])

    const prestamosActivos = prestamos.filter((prestamo) => prestamo.estado === 'prestado')

    // JOIN local por usuarioId: ya no se lee el campo redundante `receptor` (§3.3).
    const titulares = new Map(
      usuarios.map((usuario) => [
        usuario.id,
        { nombre: usuario.nombre, documento: usuario.documento },
      ]),
    )

    const morosos = prestamosActivos
      .filter((prestamo) => prestamo.fechaDevolucion < Date.now())
      .map((prestamo) => {
        const titular = titulares.get(prestamo.usuarioId)
        return {
          id: prestamo.id,
          nombre: titular?.nombre ?? 'Usuario no encontrado',
          documento: titular?.documento ?? 'sin documento',
        }
      })

    const conteoPorHerramienta = new Map<string, number>()
    for (const prestamo of prestamos) {
      conteoPorHerramienta.set(
        prestamo.herramientaId,
        (conteoPorHerramienta.get(prestamo.herramientaId) ?? 0) + 1,
      )
    }
    const nombresHerramientas = new Map(
      herramientas.map((herramienta) => [herramienta.id, herramienta.nombre]),
    )
    const topHerramientas = [...conteoPorHerramienta.entries()]
      .map(([id, total]) => ({
        nombre: nombresHerramientas.get(id) ?? 'Herramienta no encontrada',
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)

    return { prestamosActivos, morosos, topHerramientas }
  }, [])

  if (!sesion || sesion.rol !== 'ADMINISTRADOR') {
    return <Navigate to="/login" replace />
  }

  const handleCerrarSesion = () => {
    const acepta = window.confirm('¿Desea cerrar sesión?')
    if (!acepta) return
    cerrarSesion()
    navigate('/')
  }

  const cargando = reporte === undefined
  const prestamosActivos = reporte?.prestamosActivos ?? []
  const morosos = reporte?.morosos ?? []
  const topHerramientas = reporte?.topHerramientas ?? []

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
        {cargando && <p className="reportes-card-vacio">Cargando datos…</p>}

        <div className="reportes-grid">
          <article className="reportes-card">
            <h3 className="reportes-card-title">Préstamos Activos</h3>
            <p className="reportes-card-valor">{cargando ? '…' : prestamosActivos.length}</p>
            <p className="reportes-card-detalle">Préstamos en curso en este momento</p>
          </article>

          <article className="reportes-card">
            <h3 className="reportes-card-title">Usuarios morosos</h3>
            <p className="reportes-card-valor">{cargando ? '…' : morosos.length}</p>
            {!cargando && (morosos.length > 0 ? (
              <>
                <ul className="reportes-list">
                  {morosos.slice(0, LIMITE_MOROSOS).map((moroso) => (
                    <li className="reportes-item" key={moroso.id}>
                      {moroso.nombre} · {moroso.documento}
                    </li>
                  ))}
                </ul>
                {morosos.length > LIMITE_MOROSOS && (
                  <p className="reportes-card-vacio">…y {morosos.length - LIMITE_MOROSOS} más</p>
                )}
              </>
            ) : (
              <p className="reportes-card-vacio">Sin usuarios morosos</p>
            ))}
          </article>

          <article className="reportes-card">
            <h3 className="reportes-card-title">Herramientas más prestadas</h3>
            {!cargando && (topHerramientas.length > 0 ? (
              <ol className="reportes-list">
                {topHerramientas.map((herramienta) => (
                  <li className="reportes-item" key={herramienta.nombre}>
                    {herramienta.nombre} — {herramienta.total} préstamos
                  </li>
                ))}
              </ol>
            ) : (
              <p className="reportes-card-vacio">Sin datos suficientes</p>
            ))}
          </article>
        </div>
      </main>
    </div>
  )
}

export default ReportesAdmin