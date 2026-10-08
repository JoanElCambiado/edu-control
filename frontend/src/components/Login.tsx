import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../database/db'
import type { Usuario } from '../database/models'
import { guardarSesion } from '../services/session'
import { asegurarUsuariosLocales, hayRed } from '../services/syncService'
import { validarUsuario } from '../utils/validations'
import './Login.css'

function Login() {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  const usuarioInvalido = usuario.length > 0 && !validarUsuario(usuario)

  // Descarga el catálogo de usuarios en cuanto se abre la pantalla de login,
  // para que las credenciales existan en Dexie antes del primer intento.
  useEffect(() => {
    let activo = true
    void asegurarUsuariosLocales().then((total) => {
      if (activo && total === 0 && !hayRed()) {
        setError('No hay usuarios guardados en este dispositivo. Conéctese una vez para descargarlos.')
      }
    })
    return () => {
      activo = false
    }
  }, [])

  const handleUsuarioChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUsuario(event.target.value)
    if (error) setError('')
  }

  /**
   * Resuelve el actor por su clave natural (documento) y, como respaldo
   * de compatibilidad, por nombre insensible a mayúsculas.
   */
  const buscarUsuario = async (credencial: string): Promise<Usuario | undefined> => {
    const porDocumento = await db.usuarios.where('documento').equals(credencial).first()
    if (porDocumento) return porDocumento
    return db.usuarios.where('nombre').equalsIgnoreCase(credencial).first()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setCargando(true)

    try {
      const nombre = usuario.trim()

      // Si la tabla está vacía y hay red, se descarga antes de validar.
      await asegurarUsuariosLocales()

      let encontrado = await buscarUsuario(nombre)

      // Credencial desconocida en local: puede ser nueva en la nube. Se reintenta una vez.
      if (!encontrado && hayRed()) {
        await asegurarUsuariosLocales(true)
        encontrado = await buscarUsuario(nombre)
      }

      if (!encontrado) {
        const total = await db.usuarios.count()
        setError(
          total === 0
            ? 'No hay usuarios en este dispositivo. Conéctese a internet para descargarlos.'
            : 'Credenciales incorrectas',
        )
        return
      }

      if (encontrado.contrasena !== contrasena) {
        setError('Credenciales incorrectas')
        return
      }

      guardarSesion({ id: encontrado.id, nombre: encontrado.nombre, rol: encontrado.rol })

      if (encontrado.rol === 'ADMINISTRADOR') {
        navigate('/dashboard')
      } else if (encontrado.rol === 'RECEPCION') {
        navigate('/nuevo-prestamo')
      } else {
        navigate('/usuario')
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err)
      setError('No se pudo validar el acceso. Intente de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="login">
      <section className="login-card">
        <h1 className="login-title">Edu Control</h1>
        <p className="login-subtitle">Ingrese sus datos para continuar</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="usuario">
              Documento o usuario
            </label>
            <input
              className="login-input"
              id="usuario"
              name="usuario"
              type="text"
              autoComplete="username"
              autoFocus
              required
              placeholder="Ej: 1070000001 o Elena Torres"
              value={usuario}
              onChange={handleUsuarioChange}
            />
            {usuarioInvalido && (
              <p className="login-error">
                Solo letras, números, espacios y los signos . - _
              </p>
            )}
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="contrasena">
              Contraseña
            </label>
            <input
              className="login-input"
              id="contrasena"
              name="contrasena"
              type="password"
              autoComplete="current-password"
              required
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="login-button" type="submit" disabled={usuarioInvalido || cargando}>
            {cargando ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default Login