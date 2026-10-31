/// <reference types="vite/client" />
/** Declara tipos TypeScript para variables de entorno Vite. */

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

/** Contrato de datos ImportMeta utilizado por aplicacion. */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
