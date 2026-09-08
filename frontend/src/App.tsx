import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import DashboardAdmin from './components/DashboardAdmin'
import Login from './components/Login'
import { obtenerSesion } from './services/session'
import { sincronizarUsuarios } from './services/syncService'

function DefaultRedirect() {
  const sesion = obtenerSesion()
  if (sesion && sesion.rol === 'ADMINISTRADOR') {
    return <Navigate to="/dashboard" replace />
  }
  return <Navigate to="/login" replace />
}

function App() {
  useEffect(() => {
    sincronizarUsuarios()
      .then(() => console.log('Sincronización de usuarios completada'))
      .catch((err) => console.error('Error al sincronizar usuarios:', err))
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DefaultRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<DashboardAdmin />} />
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </HashRouter>
  )
}

export default App