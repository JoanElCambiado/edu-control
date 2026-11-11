import { createContext, useContext, useSyncExternalStore } from 'react'
import esCO from './locales/es-CO.json'
import enUS from './locales/en-US.json'
import arSA from './locales/ar-SA.json'
import {
  LOCALES_SOPORTADOS,
  aplicarDireccionInterfaz,
  formatearDecimal,
  formatearFecha,
  formatearMoneda,
  obtenerDireccionInterfaz,
  type CodigoLocale,
  type DireccionInterfaz,
} from './formatters'

export type { CodigoLocale, DireccionInterfaz }
export {
  LOCALES_SOPORTADOS,
  aplicarDireccionInterfaz,
  formatearDecimal,
  formatearFecha,
  formatearMoneda,
  obtenerDireccionInterfaz,
}

type ReglasPlurales = Partial<Record<Intl.LDMLPluralRule | 'zero', string>> & {
  other: string
}

type NodoDiccionario = string | ReglasPlurales | { [clave: string]: NodoDiccionario }

const DICCIONARIOS: Record<CodigoLocale, Record<string, NodoDiccionario>> = {
  'es-CO': esCO as unknown as Record<string, NodoDiccionario>,
  'en-US': enUS as unknown as Record<string, NodoDiccionario>,
  'ar-SA': arSA as unknown as Record<string, NodoDiccionario>,
}

const LOCALE_STORAGE_KEY = 'edu-control-locale'
export const LOCALE_POR_DEFECTO: CodigoLocale = 'es-CO'

function esLocaleValido(valor: unknown): valor is CodigoLocale {
  return (
    typeof valor === 'string' &&
    (LOCALES_SOPORTADOS as readonly string[]).includes(valor)
  )
}

function leerLocaleInicial(): CodigoLocale {
  try {
    if (typeof localStorage !== 'undefined') {
      const guardado = localStorage.getItem(LOCALE_STORAGE_KEY)
      if (esLocaleValido(guardado)) {
        return guardado
      }
    }
  } catch {
    // Entornos sin acceso a localStorage
  }
  return LOCALE_POR_DEFECTO
}

let localeActual: CodigoLocale = leerLocaleInicial()
const suscriptoresLocale = new Set<() => void>()

export function obtenerLocaleActivo(): CodigoLocale {
  return localeActual
}

export function suscribirLocale(oyente: () => void): () => void {
  suscriptoresLocale.add(oyente)
  return () => {
    suscriptoresLocale.delete(oyente)
  }
}

export function cambiarLocaleActivo(nuevoLocale: CodigoLocale): void {
  if (!esLocaleValido(nuevoLocale)) return
  localeActual = nuevoLocale

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, nuevoLocale)
    }
  } catch {
    // Ignorar errores de cuota de almacenamiento
  }

  aplicarDireccionInterfaz(nuevoLocale)

  for (const oyente of suscriptoresLocale) {
    oyente()
  }
}

function resolverRuta(
  diccionario: Record<string, NodoDiccionario>,
  clave: string,
): NodoDiccionario | undefined {
  const segmentos = clave.split('.')
  let actual: NodoDiccionario | undefined = diccionario

  for (const segmento of segmentos) {
    if (!actual || typeof actual === 'string') {
      return undefined
    }
    actual = (actual as Record<string, NodoDiccionario>)[segmento]
  }

  return actual
}

function esObjetoPlural(nodo: NodoDiccionario): nodo is ReglasPlurales {
  return typeof nodo === 'object' && nodo !== null && typeof (nodo as ReglasPlurales).other === 'string'
}

function interpolarVariables(
  plantilla: string,
  variables?: Record<string, string | number>,
): string {
  if (!variables) return plantilla
  return plantilla.replace(/\{\{\s*(\w+)\s*\}\}/g, (_coincidencia, nombre: string) => {
    const valor = variables[nombre]
    return valor !== undefined ? String(valor) : `{{${nombre}}}`
  })
}

/**
 * Traduce una clave estructurada (ej. `auth.login`, `loans.title`, `inventory.status`)
 * y resuelve reglas de pluralización CLDR (`zero`, `one`, `two`, `few`, `many`, `other`)
 * cuando se suministra `{ count }` en `variables`.
 */
export function traducir(
  clave: string,
  variables?: Record<string, string | number>,
  locale: CodigoLocale = localeActual,
): string {
  const diccionario = DICCIONARIOS[locale] ?? DICCIONARIOS[LOCALE_POR_DEFECTO]
  const nodo = resolverRuta(diccionario, clave) ?? resolverRuta(DICCIONARIOS[LOCALE_POR_DEFECTO], clave)

  if (nodo === undefined) {
    return clave
  }

  if (typeof nodo === 'string') {
    return interpolarVariables(nodo, variables)
  }

  if (esObjetoPlural(nodo)) {
    const conteo = typeof variables?.count === 'number' ? variables.count : 0
    if (conteo === 0 && typeof nodo.zero === 'string') {
      return interpolarVariables(nodo.zero, variables)
    }
    const categoria = new Intl.PluralRules(locale).select(conteo)
    const plantilla = nodo[categoria] ?? nodo.other
    return interpolarVariables(plantilla, variables)
  }

  return clave
}

export interface ContextoI18n {
  locale: CodigoLocale
  dir: DireccionInterfaz
  setLocale: (nuevo: CodigoLocale) => void
  t: (clave: string, variables?: Record<string, string | number>) => string
  formatDate: (fecha: Date | number | string) => string
  formatCurrency: (monto: number) => string
  formatNumber: (valor: number, decimales?: number) => string
}

export const I18nContext = createContext<ContextoI18n | null>(null)

export function crearValorContextoI18n(locale: CodigoLocale): ContextoI18n {
  return {
    locale,
    dir: obtenerDireccionInterfaz(locale),
    setLocale: cambiarLocaleActivo,
    t: (clave, variables) => traducir(clave, variables, locale),
    formatDate: (fecha) => formatearFecha(fecha, locale),
    formatCurrency: (monto) => formatearMoneda(monto, locale),
    formatNumber: (numero, decimales) => formatearDecimal(numero, locale, decimales),
  }
}

/**
 * Hook reactivo de internacionalización y localización regional.
 * Funciona tanto dentro de `<I18nProvider>` como de forma autónoma gracias a `useSyncExternalStore`.
 */
export function useI18n(): ContextoI18n {
  const contexto = useContext(I18nContext)
  const localeExterno = useSyncExternalStore(
    suscribirLocale,
    obtenerLocaleActivo,
    () => LOCALE_POR_DEFECTO,
  )

  if (contexto) {
    return contexto
  }

  return crearValorContextoI18n(localeExterno)
}

