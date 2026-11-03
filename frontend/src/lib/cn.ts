/**
 * ARCHIVO: frontend/src/lib/cn.ts
 *
 * ¿Qué es?
 * Una función pequeña que junta nombres de clases CSS (las "etiquetas de estilo" de Tailwind)
 * en un solo texto.
 *
 * ¿Para qué sirve?
 * Para escribir clases condicionales sin llenar el código de "if" y de espacios. Por ejemplo:
 *   cn("p-4", activo && "bg-azul", null, undefined)  ->  "p-4 bg-azul"
 * Los valores que son "falsy" (false, null, undefined o "") se descartan.
 *
 * ¿Quién lo usa?
 * Casi todos los componentes visuales de components/ui y de las features, para armar su className.
 */

/**
 * Recibe cualquier cantidad de clases (o valores vacíos) y devuelve un solo texto separado por espacios.
 *
 * "...classes" es un parámetro de descanso: reúne todos los argumentos en una lista.
 * "filter(Boolean)" quita los valores que no son texto útil (false, null, undefined).
 * "join(' ')" une lo que queda con un espacio entre cada clase.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
