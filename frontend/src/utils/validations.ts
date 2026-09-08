const USUARIO_REGEX = /^[a-z0-9_-]+$/

export function validarUsuario(valor: string): boolean {
  if (valor.length === 0) return false
  return USUARIO_REGEX.test(valor)
}