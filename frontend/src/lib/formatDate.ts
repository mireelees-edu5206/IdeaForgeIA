/** Formatea fechas para mostrarlas en espanol. */
const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
/** Define absolute para el bloque de servicios compartidos. */
const absolute = new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short" });

/** Define UNITS para el bloque de servicios compartidos. */
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "hace 5 minutos", "ayer", ... */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  /** Recorre los elementos del bloque servicios compartidos. */
  for (const [unit, size] of UNITS) {
    /** Rama condicional: Math.abs(seconds) >= size. */
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "hace un momento";
}

/** Expone la funcion format date time para el flujo de shared frontend. */
export function formatDateTime(iso: string): string {
  return absolute.format(new Date(iso));
}
