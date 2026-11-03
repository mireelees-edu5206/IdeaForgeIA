/**
 * ARCHIVO: frontend/src/lib/formatDate.ts
 *
 * ¿Qué es?
 * Funciones que convierten fechas en texto en español para mostrarlas en pantalla.
 *
 * ¿Para qué sirve?
 * Hay dos formas de mostrar una fecha:
 * - Relativa: "hace 5 minutos", "ayer", "hace 2 semanas". Ideal para listas de actividad reciente.
 * - Absoluta: "15 de marzo de 2026, 10:30". Ideal para detalles y registros.
 *
 * ¿Quién lo usa?
 * Listas de proyectos, investigaciones, informes y la bitácora de administración.
 *
 * Nota: las fechas llegan del backend como texto ISO (por ejemplo "2026-03-15T10:30:00Z").
 */

// Formateador relativo en español. "numeric: auto" hace que diga "ayer" en vez de "hace 1 día".
const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
// Formateador absoluto en español: fecha larga y hora corta.
const absolute = new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short" });

/**
 * Unidades de tiempo de mayor a menor, con su duración en segundos.
 * formatRelative las recorre en orden y usa la primera que quepa en la diferencia.
 */
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/**
 * Describe qué tan lejos está una fecha de "ahora", en español.
 *
 * Ejemplos: "hace 5 minutos", "ayer", "dentro de 2 horas".
 * Si la diferencia es menor a un minuto, devuelve "hace un momento".
 *
 * @param iso Fecha en formato ISO que llega del backend.
 * @param now Momento de comparación. Por defecto, el momento actual (útil para pruebas).
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  // Diferencia en segundos: positiva si la fecha es futura, negativa si ya pasó.
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    // Usa la unidad más grande que quepa. Math.abs ignora si es pasado o futuro.
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "hace un momento";
}

/**
 * Devuelve la fecha completa en español, por ejemplo "15 de marzo de 2026, 10:30".
 *
 * @param iso Fecha en formato ISO que llega del backend.
 */
export function formatDateTime(iso: string): string {
  return absolute.format(new Date(iso));
}
