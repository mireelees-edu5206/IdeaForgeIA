/**
 * ARCHIVO: frontend/src/features/settings/SettingsPage.tsx
 *
 * ¿Qué es?
 * La pantalla "Configuración" (dirección /configuracion). Reúne los datos de la cuenta, el selector de tema,
 * la instalación de la app y el cierre de sesión.
 *
 * ¿Qué se ve en pantalla?
 * 1. Encabezado con el título "Configuración".
 * 2. Columna izquierda, "Cuenta activa": la inicial del nombre en un cuadro, el nombre completo, el correo,
 *    el rol (Administrador o Investigador) y el botón "Cerrar sesión".
 * 3. Columna derecha, "Apariencia de la interfaz": dos tarjetas para elegir el modo claro o el oscuro.
 *    La elegida muestra la etiqueta "Activo".
 * 4. Abajo, la tarjeta para instalar la app (InstallPwaCard).
 *
 * ¿Cómo funciona el tema?
 * - readInitialTheme lee el tema guardado en el navegador (o el del sistema) al abrir la pantalla.
 * - Al tocar una tarjeta, applyTheme cambia el tema de inmediato y lo guarda en el navegador.
 * - Es un "radiogroup" accesible: solo una opción puede estar seleccionada a la vez.
 *
 * ¿Qué pasa al cerrar sesión?
 * El botón cambia a estado de carga (loading) para evitar clics dobles. useAuth().logout cierra la sesión
 * en Supabase, borra la caché y la app regresa a la pantalla de inicio de sesión.
 *
 * ¿Quién lo usa?
 * app/router.tsx (ruta "configuracion", dentro de AppShell).
 */
import { useState } from "react";
import { FiCheck, FiLogOut, FiMail, FiMoon, FiShield, FiSun, FiUser } from "react-icons/fi";

import { Button } from "../../components/ui/Button";
import { InstallPwaCard } from "../../components/layout/InstallPwaCard";
import { CrucibleGlyph } from "../../components/ui/ForgeGlyphs";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { type ThemeMode, applyTheme, readInitialTheme } from "../../components/ui/ThemeToggle";
import { cn } from "../../lib/cn";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../projects/components/PageHeader";

/**
 * Las dos opciones de tema que se muestran como tarjetas.
 *
 * - mode: el valor que se guarda ("light" o "dark").
 * - title y subtitle: el texto de la tarjeta.
 * - previewClass: la clase que pinta el cuadro de muestra con los colores del tema.
 * - icon: el sol o la luna.
 *
 * Para cambiar el texto o los colores de las opciones, edita esta lista.
 */
const THEME_OPTIONS: Array<{
  mode: ThemeMode;
  title: string;
  subtitle: string;
  previewClass: string;
  icon: typeof FiSun;
}> = [
  {
    mode: "light",
    title: "Modo claro",
    subtitle: "Fondo claro, alto contraste y tarjetas limpias para concentrarte en tus datos.",
    previewClass: "theme-preview theme-preview--light",
    icon: FiSun,
  },
  {
    mode: "dark",
    title: "Modo oscuro",
    subtitle: "Superficie navy con texto claro y acentos azules de baja fatiga visual.",
    previewClass: "theme-preview theme-preview--dark",
    icon: FiMoon,
  },
];

/**
 * Pantalla de configuración. No recibe props.
 */
export function SettingsPage() {
  // Título de la pestaña del navegador.
  useDocumentTitle("Configuración");
  // Datos de la persona conectada y la función para cerrar sesión.
  const { user, logout } = useAuth();
  // El tema que está activo en este momento. Empieza con el que ya tenía el navegador.
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  // true mientras se cierra la sesión: pone el botón en estado de carga.
  const [leaving, setLeaving] = useState(false);
  // Inicial del nombre para el cuadro de la cuenta. Si no hay nombre, muestra un signo de interrogación.
  const initial = user?.full_name.trim().charAt(0).toUpperCase() ?? "?";

  /**
   * Cambia el tema: lo guarda en el estado de esta pantalla y lo aplica a toda la app.
   * applyTheme es quien cambia las clases del HTML y lo guarda en el navegador.
   */
  function selectTheme(next: ThemeMode) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado de la pantalla. */}
      <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
        <PageHeader
          eyebrow="Preferencias y cuenta"
          title="Configuración"
          description="Administra tu perfil, personaliza la interfaz y gestiona tu sesión."
        />
      </GlassPanel>

      {/* Dos columnas en pantallas grandes: cuenta (izquierda) y apariencia (derecha). */}
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1.2fr]">
        {/* Perfil, correo y cierre de sesión */}
        <GlassPanel className="flex flex-col justify-between gap-6 rounded-3xl p-6">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              {/* El cuadro con la inicial es decorativo: aria-hidden evita que lo lean. El nombre completo se lee debajo. */}
              <span
                aria-hidden="true"
                className="neo-raised font-display grid size-14 shrink-0 place-items-center rounded-2xl text-xl font-bold text-accent-cyan ring-1 ring-accent-cyan/30"
              >
                {initial}
              </span>
              <div className="min-w-0">
                <p className="font-mono-tech text-[11px] font-semibold tracking-wider text-accent-cyan uppercase">
                  Cuenta activa
                </p>
                {/* "truncate" corta el nombre con puntos suspensivos si es muy largo. */}
                <h2 className="font-display truncate text-xl font-bold">{user?.full_name}</h2>
              </div>
            </div>

            {/* "dl" es una lista de pares etiqueta-valor: cada "dt" es la etiqueta y cada "dd" el dato. */}
            <dl className="flex flex-col gap-3">
              <div className="neo-inset flex items-center gap-3 rounded-2xl p-3.5">
                <FiUser aria-hidden="true" className="size-4 shrink-0 text-accent-cyan" />
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400">Nombre completo</dt>
                  <dd className="truncate text-sm font-semibold text-slate-100">{user?.full_name}</dd>
                </div>
              </div>

              <div className="neo-inset flex items-center gap-3 rounded-2xl p-3.5">
                <FiMail aria-hidden="true" className="size-4 shrink-0 text-accent-cyan" />
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400">Correo electrónico</dt>
                  <dd className="truncate text-sm font-semibold text-slate-100">{user?.email}</dd>
                </div>
              </div>

              <div className="neo-inset flex items-center gap-3 rounded-2xl p-3.5">
                <FiShield aria-hidden="true" className="size-4 shrink-0 text-accent-violet" />
                <div className="min-w-0">
                  <dt className="text-xs text-slate-400">Rol en la plataforma</dt>
                  {/* El rol "admin" se muestra como "Administrador"; cualquier otro valor se muestra como "Investigador". */}
                  <dd className="text-sm font-semibold text-slate-100">
                    {user?.role === "admin" ? "Administrador" : "Investigador"}
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          {/* Pie de la tarjeta: texto de ayuda y botón de cerrar sesión. En celular van apilados. */}
          <div className="flex flex-col gap-3 border-t border-slate-400/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              Cierra tu sesión en este dispositivo cuando termines de trabajar.
            </p>
            <Button
              variant="danger"
              loading={leaving}
              icon={<FiLogOut aria-hidden="true" />}
              onClick={() => {
                // Marca el estado de carga antes de cerrar la sesión, para que el botón no se pueda pulsar dos veces.
                setLeaving(true);
                // "void" ignora la promesa a propósito: no hace falta esperar la respuesta aquí.
                void logout();
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        </GlassPanel>

        {/* Selector visual de apariencia (modo claro u oscuro). */}
        <GlassPanel className="flex flex-col gap-5 rounded-3xl p-6">
          <div className="flex items-center gap-2.5">
            <CrucibleGlyph className="size-5 text-accent-cyan" />
            <div>
              <h2 className="font-display text-lg font-bold">Apariencia de la interfaz</h2>
              <p className="text-xs text-slate-400">
                El cambio se aplica al instante y se guarda en este navegador.
              </p>
            </div>
          </div>

          {/* "radiogroup" y "radio" indican a un lector de pantalla que solo una opción puede estar elegida. */}
          <div role="radiogroup" aria-label="Tema de la interfaz" className="grid gap-3.5">
            {THEME_OPTIONS.map(({ mode, title, subtitle, previewClass, icon: Icon }) => {
              // La opción está activa si coincide con el tema actual.
              const active = theme === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  // aria-checked informa al lector de pantalla cuál opción está marcada.
                  aria-checked={active}
                  onClick={() => selectTheme(mode)}
                  className={cn(
                    "tilt-3d jelly flex items-start gap-4 rounded-2xl p-4 text-left transition",
                    // La tarjeta activa tiene un anillo; la inactiva se ve un poco más apagada.
                    active
                      ? "neo-raised ring-2 ring-accent-cyan"
                      : "neo-inset opacity-85 hover:opacity-100",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-xl border",
                      previewClass,
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100">{title}</span>
                      {/* La etiqueta "Activo" solo aparece en la opción elegida. */}
                      {active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-cyan/15 px-2.5 py-0.5 text-xs font-semibold text-accent-cyan">
                          <FiCheck aria-hidden="true" className="size-3.5" /> Activo
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-400">{subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </GlassPanel>
      </div>
      {/* Tarjeta para instalar la app en el dispositivo (PWA). Se muestra debajo de las dos columnas. */}
      <InstallPwaCard />
    </div>
  );
}
