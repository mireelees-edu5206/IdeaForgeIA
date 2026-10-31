/**
 * ARCHIVO: navigation.ts
 *
 * ¿Qué es?
 * Es la "lista de menú" de la aplicación escrita en un solo lugar. Como una hoja con las
 * secciones del restaurante: si cambia un plato, se cambia en la hoja y todas las mesas lo ven igual.
 *
 * ¿Para qué sirve?
 * Guarda las opciones principales de navegación: Panel, Proyectos y Configuración.
 * Así la barra superior (Topbar.tsx) y el menú lateral (Sidebar.tsx) usan siempre la misma lista.
 *
 * ¿Quién lo usa?
 * - Topbar.tsx y Sidebar.tsx importan NAV_ITEMS.
 * - Ellos agregan la opción "Administración" solo si la persona es administradora.
 */

/* Traemos el tipo "IconType": la forma que tiene un icono de la librería react-icons. */
import type { IconType } from "react-icons";
/* Traemos tres iconos concretos: carpeta (Proyectos), cuadrícula (Panel) y perillas (Configuración). */
import { FiFolder, FiGrid, FiSliders } from "react-icons/fi";

/**
 * NavItem describe cómo debe verse UNA opción del menú. Es como una ficha con cuatro datos:
 * - to: a qué dirección lleva (por ejemplo "/proyectos").
 * - label: el texto que se ve (por ejemplo "Proyectos").
 * - icon: el dibujito que la acompaña.
 * - end (opcional): si es true, la opción solo se marca como activa en la dirección exacta.
 */
/** Describe el contrato nav item utilizado por shared frontend. */
export interface NavItem {
  /** La dirección a la que lleva la opción, como "/proyectos". */
  to: string;
  /** El texto que ve la persona en el menú. */
  label: string;
  /** El icono que aparece al lado del texto. */
  icon: IconType;
  /** true: solo activo en la ruta exacta (el panel "/" no debe marcarse en /proyectos). */
  /** El signo "?" significa que este campo es opcional: puede no estar. */
  end?: boolean;
}

/**
 * NAV_ITEMS es la lista real de opciones del menú: un arreglo (lista ordenada) de fichas NavItem.
 * Los corchetes [ ] indican una lista; cada llave { } es una ficha con sus datos.
 */
/** Define nav items como dato o funcion publica de shared frontend. */
export const NAV_ITEMS: NavItem[] = [
  // Primera opción: el Panel. Va a "/" y lleva "end: true" porque la página principal solo debe marcarse exactamente en "/".
  { to: "/", label: "Panel", icon: FiGrid, end: true },
  // Segunda opción: Proyectos. Va a "/proyectos". Como no pusimos "end", también se marca cuando estás dentro de un proyecto.
  { to: "/proyectos", label: "Proyectos", icon: FiFolder },
  // Tercera opción: Configuración. Va a "/configuracion".
  { to: "/configuracion", label: "Configuración", icon: FiSliders },
];
