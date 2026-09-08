import { type ReactNode, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import DashboardAdmin from './components/DashboardAdmin'
import DashboardRecepcion from './components/DashboardRecepcion'
import Login from './components/Login'
import NuevoPrestamo from './components/NuevoPrestamo'
import PanelUsuario from './components/PanelUsuario'
import ReportesAdmin from './components/ReportesAdmin'
import type { Rol } from './database/models'
import { obtenerSesion } from './services/session'
import { sincronizarUsuarios } from './services/syncService'

function ProtectedRoute({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const sesion = obtenerSesion()
  if (!sesion || !roles.includes(sesion.rol)) {
    return <Navigate to="/login" replace />
  }
  return children
}

function DefaultRedirect() {
  const sesion = obtenerSesion()
  if (sesion?.rol === 'ADMINISTRADOR') {
    return <Navigate to="/dashboard" replace />
  }
  if (sesion?.rol === 'RECEPCION') {
    return <Navigate to="/recepcion" replace />
  }
  if (sesion?.rol === 'USUARIO') {
    return <Navigate to="/usuario" replace />
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
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={['ADMINISTRADOR']}>
              <DashboardAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recepcion"
          element={
            <ProtectedRoute roles={['RECEPCION', 'ADMINISTRADOR']}>
              <DashboardRecepcion />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nuevo-prestamo"
          element={
            <ProtectedRoute roles={['RECEPCION', 'ADMINISTRADOR']}>
              <NuevoPrestamo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuario"
          element={
            <ProtectedRoute roles={['USUARIO']}>
              <PanelUsuario />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <ProtectedRoute roles={['ADMINISTRADOR']}>
              <ReportesAdmin />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </HashRouter>
  )
}

export default App