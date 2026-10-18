import type { IconType } from "react-icons";
import { FiFolder, FiGrid, FiSliders } from "react-icons/fi";

export interface NavItem {
  to: string;
  label: string;
  icon: IconType;
  /** true: solo activo en la ruta exacta (el panel "/" no debe marcarse en /proyectos). */
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Panel", icon: FiGrid, end: true },
  { to: "/proyectos", label: "Proyectos", icon: FiFolder },
  { to: "/configuracion", label: "Configuración", icon: FiSliders },
];
