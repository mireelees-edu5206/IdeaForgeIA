/** Cliente público de Supabase Auth; las claves privadas permanecen en el backend. */
import { createClient } from "@supabase/supabase-js";

/** Define supabaseUrl para el bloque de servicios compartidos. */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
/** Catalogo supabasePublishableKey que define etiquetas o reglas de servicios compartidos. */
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

/** Define supabase como dato o funcion publica de shared frontend. */
export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null;

/** Expone la funcion get supabase para el flujo de shared frontend. */
export function getSupabase() {
  /** Rama condicional: !supabase. */
  if (!supabase) {
    throw new Error("Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
  return supabase;
}
