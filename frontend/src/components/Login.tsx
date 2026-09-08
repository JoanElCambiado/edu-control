import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../database/db'
import {
  cerrarSesion,
  guardarSesion,
  obtenerSesion,
  type SesionUsuario,
} from '../services/session'
import { validarUsuario } from '../utils/validations'
import './Login.css'

function Login() {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [sesion, setSesion] = useState<SesionUsuario | null>(() => obtenerSesion())
  const navigate = useNavigate()

  const usuarioInvalido = usuario.length > 0 && !validarUsuario(usuario)

  const handleUsuarioChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUsuario(event.target.value.toLowerCase())
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const encontrado = await db.usuarios.where('nombre').equals(usuario.trim()).first()

    if (!encontrado || encontrado.contrasena !== contrasena) {
      setError('Credenciales incorrectas')
      return
    }

    const nuevaSesion: SesionUsuario = {
      id: encontrado.id,
      nombre: encontrado.nombre,
      rol: encontrado.rol,
    }
    guardarSesion(nuevaSesion)
    setSesion(nuevaSesion)
    if (nuevaSesion.rol === 'ADMINISTRADOR') {
      navigate('/dashboard')
    }
  }

  const handleLogout = () => {
    cerrarSesion()
    setSesion(null)
    setUsuario('')
    setContrasena('')
    setError('')
  }

  if (sesion) {
    return (
      <main className="login">
        <section className="login-card">
          <h1 className="login-title">Bienvenido, {sesion.nombre}</h1>
          <p className="login-subtitle">Rol: {sesion.rol}</p>
          <p className="login-success">Inicio de sesión exitoso</p>
          <button className="login-button" type="button" onClick={handleLogout}>
            Salir
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="login">
      <section className="login-card">
        <h1 className="login-title">Edu Control</h1>
        <p className="login-subtitle">Ingrese sus datos para continuar</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="usuario">
              Usuario
            </label>
            <input
              className="login-input"
              id="usuario"
              name="usuario"
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={usuario}
              onChange={handleUsuarioChange}
            />
            {usuarioInvalido && (
              <p className="login-error">
                Solo minúsculas, números, guiones (-) y guiones bajos (_)
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

          <button className="login-button" type="submit" disabled={usuarioInvalido}>
            Entrar
          </button>
        </form>
      </section>
    </main>
  )
}

export default Login