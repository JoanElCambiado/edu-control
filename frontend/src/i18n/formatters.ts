export type CodigoLocale = 'es-CO' | 'en-US' | 'ar-SA'
export type DireccionInterfaz = 'ltr' | 'rtl'
export type CodigoMoneda = 'COP' | 'USD' | 'SAR'

export const LOCALES_SOPORTADOS: readonly CodigoLocale[] = ['es-CO', 'en-US', 'ar-SA'] as const

export const MONEDA_POR_LOCALE: Record<CodigoLocale, CodigoMoneda> = {
  'es-CO': 'COP',
  'en-US': 'USD',
  'ar-SA': 'SAR',
}

function normalizarFecha(entrada: Date | number | string): Date {
  const fecha = entrada instanceof Date ? entrada : new Date(entrada)
  if (Number.isNaN(fecha.getTime())) {
    throw new Error('Fecha inválida para formateo regional')
  }
  return fecha
}

/**
 * Formatea una fecha dinámicamente según el Locale activo usando `Intl.DateTimeFormat`:
 * - `es-CO`: `DD/MM/AAAA` (ej. `25/03/2026`)
 * - `en-US`: `MM/DD/YYYY` (ej. `03/25/2026`)
 * - `ar-SA`: Calendario árabe islámico Umm al-Qura (`ar-SA-u-ca-islamic-umalqura`)
 */
export function formatearFecha(
  entrada: Date | number | string,
  locale: CodigoLocale = 'es-CO',
  timeZone = 'UTC',
): string {
  const fecha = normalizarFecha(entrada)

  if (locale === 'ar-SA') {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone,
    }).format(fecha)
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  }).format(fecha)
}

/**
 * Formatea un valor numérico con separadores de miles y decimales propios del Locale
 * mediante `Intl.NumberFormat`.
 */
export function formatearDecimal(
  valor: number,
  locale: CodigoLocale = 'es-CO',
  decimales = 2,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)
}

/**
 * Formatea un monto monetario dinámicamente según la región activa usando `Intl.NumberFormat`:
 * - `es-CO`: `$ 50.000,00 COP`
 * - `en-US`: `$50,000.00 USD`
 * - `ar-SA`: Formato monetario árabe saudí con divisa `SAR`
 */
export function formatearMoneda(monto: number, locale: CodigoLocale = 'es-CO'): string {
  const moneda = MONEDA_POR_LOCALE[locale]

  if (locale === 'es-CO') {
    const numeroRegional = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto)
    return `$ ${numeroRegional} ${moneda}`
  }

  if (locale === 'en-US') {
    const monedaRegional = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto)
    return `${monedaRegional} ${moneda}`
  }

  const monedaArabe = new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto)
  return `${monedaArabe} (${moneda})`
}

/**
 * Determina de forma pura la dirección de escritura de la interfaz según el Locale:
 * - `ltr` para `es-CO` y `en-US`
 * - `rtl` para `ar-SA`
 */
export function obtenerDireccionInterfaz(locale: CodigoLocale): DireccionInterfaz {
  return locale === 'ar-SA' ? 'rtl' : 'ltr'
}

/**
 * Ajusta automáticamente los atributos `dir="ltr" | "rtl"` y `lang` en la etiqueta `<html>`
 * del documento activo sin recargar la página.
 */
export function aplicarDireccionInterfaz(locale: CodigoLocale): {
  dir: DireccionInterfaz
  lang: CodigoLocale
} {
  const dir = obtenerDireccionInterfaz(locale)

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', locale)
    document.documentElement.dir = dir
    document.documentElement.lang = locale
  }

  return { dir, lang: locale }
}

/** Alias en inglés para interoperabilidad */
export const formatDate = formatearFecha
export const formatNumber = formatearDecimal
export const formatCurrency = formatearMoneda
export const getDirection = obtenerDireccionInterfaz
export const applyDocumentDirection = aplicarDireccionInterfaz

