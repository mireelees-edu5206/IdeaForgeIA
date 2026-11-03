/**
 * ARCHIVO: frontend/src/lib/supabaseClient.ts
 *
 * ¿Qué es?
 * La conexión de la app con Supabase, el servicio que maneja el inicio de sesión (correo, contraseña
 * y Google). Crea un "cliente" que la app usa para pedir, renovar y cerrar la sesión.
 *
 * ¿Para qué sirve?
 * Para que el inicio de sesión funcione en el navegador. Solo usa la clave PÚBLICA de Supabase
 * (la "publishable key"), que es segura de exponer. Las claves privadas viven solo en el backend.
 *
 * ¿De dónde salen los valores?
 * Vite los lee del archivo frontend/.env (o de las variables de entorno de Vercel) y los incrusta en
 * el código al compilar. Por eso, si cambias una variable, hay que volver a compilar o redeployar.
 *
 * ¿Qué pasa si faltan?
 * El cliente queda en null y la app muestra el estado "no disponible" en vez de romperse.
 *
 * ¿Quién lo usa?
 * AuthProvider (para escuchar la sesión), apiClient (para poner el token en cada petición) y los
 * formularios de login y registro.
 */
import { createClient } from "@supabase/supabase-js";

// Lee la URL del proyecto de Supabase desde las variables de entorno. "?.trim()" quita espacios
// sobrantes, y el "?" evita un error si la variable no existe.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
// La clave pública de Supabase (no es un secreto: se diseñó para estar en el navegador).
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

/**
 * El cliente de Supabase, o null si falta alguna de las dos variables.
 *
 * Opciones del cliente:
 * - autoRefreshToken: renueva el token de sesión automáticamente antes de que venza.
 * - detectSessionInUrl: si la página se abre con datos de sesión en la dirección (por ejemplo, al volver
 *   de Google), los lee y los guarda.
 * - persistSession: guarda la sesión en el navegador, para no pedir la contraseña en cada visita.
 */
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

/**
 * Devuelve el cliente de Supabase, pero lanza un error claro si no está configurado.
 *
 * Úsala solo donde de verdad se necesita Supabase; en el resto, revisa "supabase" directamente.
 */
export function getSupabase() {
  if (!supabase) {
    throw new Error("Configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
  return supabase;
}
