import { describe, it, expect } from 'vitest';

// Lógica pura simulada del servicio de Login (Aislamiento del componente)
const simularLogin = (usuario: string, contrasena: string) => {
  if (!usuario || !contrasena) throw new Error("Campos obligatorios vacíos");
  if (usuario.toLowerCase() === "recepcion" && contrasena === "1234") return { token: "jwt-123", rol: "RECEPCION" };
  if (usuario.toLowerCase() === "recepcion" && contrasena !== "1234") return { error: "Contraseña incorrecta" };
  return { error: "Usuario no encontrado" };
};

describe('Módulo de Login (CU-01)', () => {
  it('PU-01: Login exitoso con credenciales correctas (Happy Path)', () => {
    // Arrange & Act
    const resultado = simularLogin("recepcion", "1234");
    // Assert
    expect(resultado).toHaveProperty('token');
    expect(resultado.rol).toBe("RECEPCION");
  });

  it('PU-02: Rechazo por contraseña incorrecta (Caso Negativo)', () => {
    const resultado = simularLogin("recepcion", "clave_falsa");
    expect(resultado.error).toBe("Contraseña incorrecta");
  });

  it('PU-03: Rechazo por usuario inexistente en BD (Caso Negativo)', () => {
    const resultado = simularLogin("fantasma", "1234");
    expect(resultado.error).toBe("Usuario no encontrado");
  });

  it('PU-04: Bloqueo al enviar campos vacíos (Límite/Frontera)', () => {
    // Assert esperando que la función explote con el error correcto
    expect(() => simularLogin("", "")).toThrow("Campos obligatorios vacíos");
  });

  it('PU-05: Inicio de sesión insensible a mayúsculas (Edge Case)', () => {
    const resultado = simularLogin("RECEPCION", "1234");
    expect(resultado).toHaveProperty('token');
  });
});