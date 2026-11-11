import { type ChangeEvent } from 'react'
import {
  LOCALES_SOPORTADOS,
  useI18n,
  type CodigoLocale,
} from '../i18n'

interface LocaleSwitcherProps {
  /** Muestra una cápsula demostrativa con fecha, moneda y dirección activa */
  mostrarResumenRegional?: boolean
  /** Fecha de muestra para el resumen regional */
  fechaMuestra?: Date | number | string
  /** Monto de muestra para el resumen regional */
  montoMuestra?: number
}

const ETIQUETAS_CORTAS: Record<CodigoLocale, string> = {
  'es-CO': 'ES-CO · COP',
  'en-US': 'EN-US · USD',
  'ar-SA': 'AR-SA · SAR',
}

function LocaleSwitcher({
  mostrarResumenRegional = false,
  fechaMuestra = '2026-11-11T12:00:00Z',
  montoMuestra = 50000,
}: LocaleSwitcherProps) {
  const { locale, dir, setLocale, t, formatDate, formatCurrency } = useI18n()

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLocale(event.target.value as CodigoLocale)
  }

  return (
    <div
      className="locale-switcher"
      dir={dir}
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.35rem 0.65rem',
        borderRadius: '0.5rem',
        backgroundColor: '#f8fafc',
        border: '1px solid #cbd5e1',
        fontSize: '0.85rem',
        color: '#1e293b',
      }}
    >
      <label
        htmlFor="edu-control-locale-select"
        style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        {t('locale.label')}:
      </label>

      <select
        id="edu-control-locale-select"
        aria-label={t('locale.label')}
        value={locale}
        onChange={handleSelectChange}
        style={{
          padding: '0.25rem 0.45rem',
          borderRadius: '0.375rem',
          border: '1px solid #94a3b8',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          fontSize: '0.85rem',
          cursor: 'pointer',
        }}
      >
        {LOCALES_SOPORTADOS.map((codigo) => (
          <option key={codigo} value={codigo}>
            {t(`locale.${codigo}`)} ({ETIQUETAS_CORTAS[codigo]})
          </option>
        ))}
      </select>

      <div
        role="group"
        aria-label={t('locale.label')}
        style={{ display: 'inline-flex', gap: '0.25rem' }}
      >
        {LOCALES_SOPORTADOS.map((codigo) => {
          const activo = locale === codigo
          return (
            <button
              key={codigo}
              type="button"
              onClick={() => setLocale(codigo)}
              aria-pressed={activo}
              style={{
                padding: '0.2rem 0.45rem',
                borderRadius: '0.3rem',
                border: activo ? '1px solid #2563eb' : '1px solid #cbd5e1',
                backgroundColor: activo ? '#2563eb' : '#ffffff',
                color: activo ? '#ffffff' : '#334155',
                fontWeight: activo ? 600 : 400,
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {codigo}
            </button>
          )
        })}
      </div>

      {mostrarResumenRegional && (
        <span
          style={{
            display: 'inline-flex',
            gap: '0.5rem',
            paddingInlineStart: '0.4rem',
            borderInlineStart: '1px solid #cbd5e1',
            fontSize: '0.78rem',
            color: '#475569',
          }}
        >
          <strong title="Direction">{dir.toUpperCase()}</strong>
          <span>{formatDate(fechaMuestra)}</span>
          <span>{formatCurrency(montoMuestra)}</span>
        </span>
      )}
    </div>
  )
}

export default LocaleSwitcher

