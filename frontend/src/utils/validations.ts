// Nombre de usuario: letras (con acentos), numeros, espacios y . - _
const USUARIO_REGEX = /^[\p{L}\p{N} ._-]+$/u

export function validarUsuario(valor: string): boolean {
  const limpio = valor.trim()
  if (limpio.length === 0) return false
  return USUARIO_REGEX.test(limpio)
}
