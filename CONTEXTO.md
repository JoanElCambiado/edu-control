# Contexto del Proyecto: Edu Control

## 1. Arquitectura General
- **Tipo de Aplicación:** Web PWA Offline-First.
- **Enfoque:** 100% operativa sin conexión a internet.
- **Estrategia de Datos:** 
  - Las lecturas y escrituras (préstamos, catálogo) ocurren en IndexedDB (local) primero.
  - Al detectar red, los datos encolados se envían en ráfagas al Backend.

## 2. Stack Tecnológico
- **Frontend:** React + Vite + TypeScript
- **Offline / PWA:** Service Workers (`vite-plugin-pwa`)
- **Persistencia Local:** Dexie.js (Wrapper de IndexedDB)
- **Backend API:** Node.js + Express + TypeScript
- **ORM & BD Nube:** Prisma + PostgreSQL
- **Identificadores:** Todos los modelos deben usar `UUID v4` como Clave Primaria (PK) para evitar colisiones en la nube.

## 3. Reglas de Desarrollo
1. Todo componente UI debe ser simple e intuitivo (diseñado para usuarios con baja alfabetización digital).
2. Nunca asumas que hay conexión a internet disponible en las llamadas del Frontend.
3. Toda transacción local (creación de préstamo o usuario) debe generar su UUID antes de guardar en IndexedDB.