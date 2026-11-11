import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import {
  I18nContext,
  LOCALE_POR_DEFECTO,
  aplicarDireccionInterfaz,
  cambiarLocaleActivo,
  crearValorContextoI18n,
  obtenerLocaleActivo,
  suscribirLocale,
  type CodigoLocale,
} from './index'

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode
  initialLocale?: CodigoLocale
}) {
  useEffect(() => {
    if (initialLocale && initialLocale !== obtenerLocaleActivo()) {
      cambiarLocaleActivo(initialLocale)
    } else {
      aplicarDireccionInterfaz(obtenerLocaleActivo())
    }
  }, [initialLocale])

  const locale = useSyncExternalStore(
    suscribirLocale,
    obtenerLocaleActivo,
    () => initialLocale ?? LOCALE_POR_DEFECTO,
  )

  return (
    <I18nContext.Provider value={crearValorContextoI18n(locale)}>
      {children}
    </I18nContext.Provider>
  )
}

export default I18nProvider

