/**
 * ARCHIVO: frontend/src/vite-env.d.ts
 *
 * ¿Qué es?
 * Un archivo de declaraciones de tipos (la terminación ".d.ts" significa "solo describe tipos, no
 * contiene código que se ejecute").
 *
 * ¿Para qué sirve?
 * Le dice a TypeScript qué variables de entorno existen y qué tipo tienen. Así, si escribes
 * import.meta.env.VITE_ALGO y no está declarada aquí, el editor avisa del error.
 *
 * Variables declaradas:
 * - VITE_API_URL: dirección base del backend (por ejemplo, el túnel público). Si falta, se usa /api/v1
 *   del mismo sitio. Opcional.
 * - VITE_SUPABASE_URL: dirección del proyecto de Supabase. Opcional.
 * - VITE_SUPABASE_PUBLISHABLE_KEY: clave pública de Supabase. Opcional.
 *
 * Todas son opcionales ("?") porque la app debe poder arrancar y mostrar un aviso si faltan.
 *
 * ¿Cómo se usa una variable nueva?
 * 1. Agrégala aquí con su tipo.
 * 2. Ponla en frontend/.env (y en Vercel) con el prefijo VITE_. Solo las que empiezan con VITE_ llegan al navegador.
 */

/// <reference types="vite/client" />

/** Lista de variables de entorno que la app puede leer en el navegador. */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

/** Extiende import.meta con las variables de arriba, para que import.meta.env tenga tipos. */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
