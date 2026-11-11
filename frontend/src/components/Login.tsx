import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../database/db'
import type { Rol, Usuario } from '../database/models'
import { useI18n } from '../i18n'
import { guardarSesion } from '../services/session'
import { asegurarUsuariosLocales, hayRed } from '../services/syncService'
import { registrarParEnBoveda, tokenizar } from '../services/tokenVault'
import { validarUsuario } from '../utils/validations'
import LocaleSwitcher from './LocaleSwitcher'
import './Login.css'

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api') as string

interface RespuestaLoginJwt {
  token: string
  usuario: {
    id: string
    nombre: string
    rol: Rol
    documentoToken: string
  }
}

function Login() {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [errorKey, setErrorKey] = useState('')
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()
  const { t, dir } = useI18n()

  const usuarioInvalido = usuario.length > 0 && !validarUsuario(usuario)

  // Descarga el catálogo de usuarios en cuanto se abre la pantalla de login,
  // para que las credenciales existan en Dexie antes del primer intento.
  useEffect(() => {
    let activo = true
    void asegurarUsuariosLocales().then((total) => {
      if (activo && total === 0 && !hayRed()) {
        setErrorKey('auth.noLocalUsersOffline')
      }
    })
    return () => {
      activo = false
    }
  }, [])

  const handleUsuarioChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUsuario(event.target.value)
    if (errorKey) setErrorKey('')
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
    setErrorKey('')
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
        setErrorKey(total === 0 ? 'auth.noLocalUsersConnect' : 'auth.invalidCredentials')
        return
      }

      if (encontrado.contrasena !== contrasena) {
        setErrorKey('auth.invalidCredentials')
        return
      }

      let documentoToken = tokenizar(encontrado.documento)
      let jwtToken: string | undefined

      if (hayRed()) {
        try {
          const respuesta = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuario: encontrado.documento,
              contrasena,
            }),
          })

          if (respuesta.ok) {
            const datosJwt = (await respuesta.json()) as RespuestaLoginJwt
            jwtToken = datosJwt.token
            if (datosJwt.usuario?.documentoToken) {
              documentoToken = datosJwt.usuario.documentoToken
              registrarParEnBoveda(documentoToken, encontrado.documento)
            }
          }
        } catch {
          // Si el backend no responde, se mantiene intacto el flujo offline-first con Dexie
        }
      }

      guardarSesion({
        id: encontrado.id,
        nombre: encontrado.nombre,
        rol: encontrado.rol,
        token: jwtToken,
        documentoToken,
      })

      if (encontrado.rol === 'ADMINISTRADOR') {
        navigate('/dashboard')
      } else if (encontrado.rol === 'RECEPCION') {
        navigate('/nuevo-prestamo')
      } else {
        navigate('/usuario')
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err)
      setErrorKey('auth.accessValidationError')
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="login" dir={dir}>
      <section className="login-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '0.75rem',
          }}
        >
          <LocaleSwitcher />
        </div>
        <h1 className="login-title">
          {t('auth.title')} · {t('auth.login')}
        </h1>
        <p className="login-subtitle">{t('auth.subtitle')}</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="usuario">
              {t('auth.usernameLabel')}
            </label>
            <input
              className="login-input"
              id="usuario"
              name="usuario"
              type="text"
              autoComplete="username"
              autoFocus
              required
              placeholder={t('auth.usernamePlaceholder')}
              value={usuario}
              onChange={handleUsuarioChange}
            />
            {usuarioInvalido && (
              <p className="login-error">{t('auth.usernameValidation')}</p>
            )}
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="contrasena">
              {t('auth.passwordLabel')}
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

          {errorKey && <p className="login-error">{t(errorKey)}</p>}

          <button className="login-button" type="submit" disabled={usuarioInvalido || cargando}>
            {cargando ? t('auth.verifying') : t('auth.submit')}
          </button>
        </form>
      </section>
    </main>
  )
}

export default Login