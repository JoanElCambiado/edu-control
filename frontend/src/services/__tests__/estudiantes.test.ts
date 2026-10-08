import { describe, it, expect, beforeEach } from 'vitest';

// Simulador de la base de datos local para la prueba (Mock de estado)
let dbUsuarios: any[] = [];

const registrarUsuario = (doc: string, nombre: string) => {
  if (!doc || !nombre) throw new Error("Faltan datos");
  if (dbUsuarios.find(u => u.doc === doc)) throw new Error("Documento duplicado");
  const nuevo = { doc, nombre, estado: "Activo" };
  dbUsuarios.push(nuevo);
  return nuevo;
};

const desactivarUsuario = (doc: string) => {
  const usuario = dbUsuarios.find(u => u.doc === doc);
  if (usuario) usuario.estado = "Inactivo";
  return usuario;
};

describe('Módulo de Gestión de Usuarios/Estudiantes (CU-07)', () => {
  
  // Arrange global: Limpiamos la "base de datos" antes de cada prueba
  beforeEach(() => {
    dbUsuarios = []; 
  });

  it('PU-06: Registro exitoso de estudiante nuevo (Happy Path)', () => {
    const est = registrarUsuario("1001", "Nicolas Rueda");
    expect(est.nombre).toBe("Nicolas Rueda");
    expect(dbUsuarios.length).toBe(1);
  });

  it('PU-07: Rechazo automático por documento duplicado (Caso Negativo)', () => {
    registrarUsuario("1001", "Nicolas Rueda");
    // Intentar registrar a Joan con la cédula de Nicolás debe fallar
    expect(() => registrarUsuario("1001", "Joan Saenz")).toThrow("Documento duplicado");
  });

  it('PU-08: Desactivación lógica de estudiante (Basada en Estado)', () => {
    registrarUsuario("1001", "Nicolas Rueda");
    const est = desactivarUsuario("1001");
    expect(est?.estado).toBe("Inactivo");
  });

  it('PU-09: Persistencia correcta de múltiples usuarios (Verificación de Estado)', () => {
    registrarUsuario("1001", "Nicolas Rueda");
    registrarUsuario("1002", "Joan Saenz");
    expect(dbUsuarios.length).toBe(2);
  });

  it('PU-10: Error al intentar registrar sin enviar el documento (Frontera)', () => {
    expect(() => registrarUsuario("", "Joan Saenz")).toThrow("Faltan datos");
  });
});