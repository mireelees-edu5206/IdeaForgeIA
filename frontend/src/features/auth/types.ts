/**
 * ARCHIVO: auth/types.ts
 *
 * ¿Qué es?
 * Son las "fichas de forma" de los datos de la cuenta: cómo se ve una persona usuaria, qué datos
 * manda el formulario de registro y cuáles el de inicio de sesión. Como un formato de solicitud
 * impreso: dice qué casillas existen, sin llenarlas.
 *
 * ¿Para qué sirve?
 * TypeScript usa estas fichas para avisar si alguien escribe mal un nombre de campo
 * (por ejemplo "correo" en lugar de "email") antes de que la app se ejecute.
 *
 * ¿Quién lo usa?
 * AuthContext.ts, AuthProvider.tsx, api.ts, guards.tsx, LoginPage.tsx y RegisterPage.tsx.
 *
 * Este archivo no dibuja nada en la pantalla: solo describe datos.
 */

/**
 * UserRole es una lista cerrada con dos palabras posibles: "user" (usuario normal) o "admin"
 * (administrador). Define qué partes de la app puede ver cada persona.
 */
export type UserRole = "user" | "admin";

/**
 * User describe a la persona con la sesión iniciada. Cada línea es un dato:
 * - id: su identificador único (un código largo que nunca se repite).
 * - email: su correo.
 * - full_name: su nombre completo, como lo escribió al registrarse.
 * - role: "user" o "admin", según sus permisos.
 * - created_at: la fecha y hora en que creó la cuenta, en texto.
 */
/** Describe el contrato user utilizado por auth. */
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

/**
 * RegisterInput son los datos que se piden en el formulario de registro:
 * correo, contraseña y nombre completo.
 */
/** Describe el contrato register input utilizado por auth. */
export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
}

/**
 * LoginInput son los datos del formulario de inicio de sesión: correo y contraseña.
 */
/** Describe el contrato login input utilizado por auth. */
export interface LoginInput {
  email: string;
  password: string;
}
