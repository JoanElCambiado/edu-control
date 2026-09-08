import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../database/db'
import { type EstadoFisico, type Herramienta } from '../database/models'
import { uuidv4 } from '../database/uuid'
import './FormularioHerramienta.css'

const ESTADOS_FISICOS: Array<{ value: EstadoFisico; label: string }> = [
  { value: 'excelente', label: 'Excelente' },
  { value: 'bueno', label: 'Bueno' },
  { value: 'regular', label: 'Regular' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
]

const etiquetaEstado = (estado: EstadoFisico) =>
  ESTADOS_FISICOS.find((e) => e.value === estado)?.label ?? estado

function FormularioHerramienta() {
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('')
  const [estadoFisico, setEstadoFisico] = useState<EstadoFisico>('bueno')
  const [cantidad, setCantidad] = useState(1)
  const [mensaje, setMensaje] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoCreatedAt, setEditandoCreatedAt] = useState<number | null>(null)

  const herramientas = useLiveQuery(
    () => db.herramientas.orderBy('nombre').toArray(),
    [],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMensaje('')

    const ahora = Date.now()
    const datos: Herramienta = {
      id: editandoId ?? uuidv4(),
      nombre: nombre.trim(),
      categoria: categoria.trim(),
      estadoFisico,
      cantidad,
      disponible: true,
      createdAt: editandoCreatedAt ?? ahora,
      updatedAt: ahora,
    }

    if (editandoId) {
      await db.herramientas.update(editandoId, datos)
      setMensaje('Herramienta actualizada')
    } else {
      await db.herramientas.add(datos)
      setMensaje('Herramienta guardada')
    }

    setEditandoId(null)
    setEditandoCreatedAt(null)
    setNombre('')
    setCategoria('')
    setEstadoFisico('bueno')
    setCantidad(1)
  }

  const handleEditar = (herramienta: Herramienta) => {
    setEditandoId(herramienta.id)
    setEditandoCreatedAt(herramienta.createdAt)
    setNombre(herramienta.nombre)
    setCategoria(herramienta.categoria)
    setEstadoFisico(herramienta.estadoFisico)
    setCantidad(herramienta.cantidad)
    setMensaje('')
  }

  const handleEditarCancelar = () => {
    setEditandoId(null)
    setEditandoCreatedAt(null)
    setNombre('')
    setCategoria('')
    setEstadoFisico('bueno')
    setCantidad(1)
    setMensaje('')
  }

  const handleEliminar = async (herramienta: Herramienta) => {
    const confirmado = window.confirm(`¿Eliminar "${herramienta.nombre}" del catálogo?`)
    if (!confirmado) return
    await db.herramientas.delete(herramienta.id)
    setMensaje('Herramienta eliminada')
  }

  return (
    <section className="herramienta">
      <h2 className="dashboard-title">
        {editandoId ? 'Editar Herramienta' : 'Catálogo de Herramientas'}
      </h2>

      <form className="herramienta-form" onSubmit={handleSubmit}>
        <div className="herramienta-field">
          <label className="herramienta-label" htmlFor="herramienta-nombre">
            Nombre de la herramienta
          </label>
          <input
            className="herramienta-input"
            id="herramienta-nombre"
            name="nombre"
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div className="herramienta-field">
          <label className="herramienta-label" htmlFor="herramienta-categoria">
            Categoría
          </label>
          <input
            className="herramienta-input"
            id="herramienta-categoria"
            name="categoria"
            type="text"
            required
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
        </div>

        <div className="herramienta-field">
          <label className="herramienta-label" htmlFor="herramienta-estado">
            Estado físico
          </label>
          <select
            className="herramienta-input"
            id="herramienta-estado"
            name="estadoFisico"
            value={estadoFisico}
            onChange={(e) => setEstadoFisico(e.target.value as EstadoFisico)}
          >
            {ESTADOS_FISICOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>

        <div className="herramienta-field">
          <label className="herramienta-label" htmlFor="herramienta-cantidad">
            Cantidad / Stock
          </label>
          <input
            className="herramienta-input"
            id="herramienta-cantidad"
            name="cantidad"
            type="number"
            min={1}
            required
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
          />
        </div>

        {mensaje && <p className="herramienta-success">{mensaje}</p>}

        <div className="herramienta-actions">
          <button className="herramienta-button" type="submit">
            {editandoId ? 'Guardar Cambios' : 'Guardar Herramienta'}
          </button>
          {editandoId && (
            <button
              className="herramienta-button herramienta-button--secondary"
              type="button"
              onClick={handleEditarCancelar}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <h3 className="herramienta-list-title">Herramientas registradas</h3>

      {herramientas && herramientas.length > 0 ? (
        <table className="herramienta-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Estado</th>
              <th>Stock</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {herramientas.map((h) => (
              <tr key={h.id}>
                <td>{h.nombre}</td>
                <td>{h.categoria}</td>
                <td>{etiquetaEstado(h.estadoFisico)}</td>
                <td>{h.cantidad}</td>
                <td className="herramienta-acciones">
                  <button
                    className="herramienta-btn-accion"
                    type="button"
                    onClick={() => handleEditar(h)}
                  >
                    Editar
                  </button>
                  <button
                    className="herramienta-btn-accion herramienta-btn-accion--danger"
                    type="button"
                    onClick={() => handleEliminar(h)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="herramienta-empty">Aún no hay herramientas registradas.</p>
      )}
    </section>
  )
}

export default FormularioHerramienta