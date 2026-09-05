import { useEffect } from 'react'
import Login from './components/Login'
import { sincronizarUsuarios } from './services/syncService'

function App() {
  useEffect(() => {
    sincronizarUsuarios()
      .then(() => console.log('Sincronización de usuarios completada'))
      .catch((err) => console.error('Error al sincronizar usuarios:', err))
  }, [])

  return <Login />
}

export default App