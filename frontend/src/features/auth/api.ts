/**
 * ARCHIVO: auth/api.ts
 *
 * ¿Qué es?
 * Es el "mensajero" de la cuenta: un archivo pequeño que sabe cómo pedirle al servidor
 * los datos de la persona que inició sesión.
 *
 * ¿Para qué sirve?
 * Separa la comunicación con el servidor de la pantalla. Así, si la dirección cambia,
 * solo hay que modificarla aquí y no en cada pantalla.
 *
 * ¿Quién lo usa?
 * AuthProvider.tsx lo llama para saber quién es el usuario después de iniciar sesión.
 *
 * Nota: el inicio y el registro NO pasan por aquí. Esos los maneja Supabase directamente
 * desde AuthProvider.tsx.
 */

/* "apiRequest" es la función central que habla con el backend: agrega la credencial y convierte los errores. */
import { apiRequest } from "../../lib/apiClient";
/* Traemos la ficha de forma del usuario (sus datos), solo para indicar qué devuelve la petición. */
import type { User } from "./types";

/**
 * authApi agrupa las peticiones de la cuenta. Por ahora solo tiene una: "me".
 * Se llama "me" (yo) porque pregunta: "¿quién soy?", es decir, los datos de la persona conectada.
 */
/** Define auth api como dato o funcion publica de auth. */
export const authApi = {
  // Pide al backend GET /api/v1/users/me. El backend revisa el token de Supabase y devuelve el perfil local (con su rol).
  // "apiRequest<User>" le dice que la respuesta tendrá la forma de User.
  me: () => apiRequest<User>("/users/me"),
};
