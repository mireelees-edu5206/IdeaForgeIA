/**
 * ARCHIVO: AuthLayout.tsx
 *
 * ¿Qué es?
 * Es el diseño de las pantallas de entrar y registrarse. Tiene dos partes:
 * - A la izquierda (solo en computadoras): una presentación de IdeaForge con tres pasos.
 * - A la derecha: una tarjeta de cristal con el título, el formulario y un pie con un enlace.
 * En celulares solo se ve la tarjeta, porque la presentación se oculta.
 *
 * ¿Para qué sirve?
 * Para que la pantalla de inicio de sesión y la de registro tengan exactamente el mismo diseño.
 * Cada pantalla solo le pasa su título, su subtítulo, su formulario y su pie.
 *
 * ¿Quién lo usa?
 * LoginPage.tsx y RegisterPage.tsx de la carpeta features/auth.
 */

/* "ReactNode" es cualquier contenido que React puede dibujar (texto, formularios, enlaces...). */
import type { ReactNode } from "react";

/* Dibujitos propios de la marca: el crisol, el hilo de trazabilidad y el sello de etapa. */
import { CrucibleGlyph, FilamentBridgeGlyph, StageSealGlyph } from "../ui/ForgeGlyphs";
/* La tarjeta de cristal, el logo y el interruptor de tema, igual que en el resto de la app. */
import { GlassPanel } from "../ui/GlassPanel";
import { Logo } from "../ui/Logo";
import { ThemeToggle } from "../ui/ThemeToggle";
/* El fondo animado con bolas de luz. */
import { Backdrop } from "./Backdrop";

/**
 * AuthLayoutProps describe lo que la pantalla de entrada le pasa al diseño:
 * - title: el título grande de la tarjeta (por ejemplo "Iniciar sesión").
 * - subtitle: la frase pequeña debajo del título.
 * - children: el formulario (los campos y botones).
 * - footer: lo que va al final, por ejemplo "¿No tienes cuenta? Regístrate".
 */
/** Contrato de datos AuthLayoutProps utilizado por interfaz compartida. */
interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * FACETS es la lista de los tres pasos que se muestran en la presentación de la izquierda.
 * Cada paso tiene: un código ("PASO · 01"), un título, una explicación, un color (tone)
 * y la etapa del sello que le corresponde (status).
 *
 * "as const" le dice a TypeScript que el texto de "status" es fijo (no cualquier texto).
 */
/** Define FACETS para el bloque de interfaz compartida. */
const FACETS = [
  {
    code: "PASO · 01",
    title: "Organiza tu idea",
    text: "Aclara qué problema quieres resolver y quién lo tiene.",
    // Clase de color verde (la de "evidencia").
    tone: "text-kind-evidence",
    // Sello de la etapa "investigando" (el círculo punteado con rombo).
    status: "researching" as const,
  },
  {
    code: "PASO · 02",
    title: "Busca información",
    text: "Consulta fuentes para conocer el mercado y las opciones actuales.",
    // Clase de color azul (la de "análisis").
    tone: "text-kind-analysis",
    // Sello de la etapa "estructurado" (el hexágono con líneas).
    status: "structured" as const,
  },
  {
    code: "PASO · 03",
    title: "Revisa antes de decidir",
    text: "Distingue lo que sabemos de lo que todavía falta comprobar.",
    // Clase de color ámbar (la de "hipótesis").
    tone: "text-kind-hypothesis",
    // Sello de la etapa "analizado" (el cristal tallado).
    status: "analyzed" as const,
  },
];

/**
 * AuthLayout arma toda la pantalla de entrada o registro.
 *
 * Cómo se usa (ejemplo):
 * <AuthLayout title="Iniciar sesión" subtitle="Entra a tu cuenta" footer={<a href="/registro">Crear cuenta</a>}>
 *   ...formulario...
 * </AuthLayout>
 */
/** Expone la funcion auth layout para el flujo de shared frontend. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    // Contenedor de toda la pantalla: ocupa al menos la altura visible, con espacio alrededor.
    // "min-h-dvh" usa la altura real de la pantalla (también en celulares con barra del navegador).
    <div className="relative min-h-dvh px-4 py-6 sm:px-6 lg:px-10">
      {/* El fondo animado, detrás de todo (ver Backdrop.tsx). */}
      <Backdrop />
      {/* La barra de arriba: el logo a la izquierda y el interruptor de tema a la derecha. "z-10" la pone encima del fondo. */}
      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between pb-6">
        <Logo />
        <ThemeToggle />
      </div>

      {/* El contenido principal en dos columnas en computadoras: "lg:grid-cols-[1.15fr_28rem]" = la presentación ocupa más, y la tarjeta mide 28 rem. */}
      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 py-4 lg:grid-cols-[1.15fr_28rem]">
        {/* La presentación de la izquierda. "hidden ... lg:flex" la oculta en celulares y la muestra en computadoras. */}
        <section aria-label="Presentación de IdeaForge AI" className="hidden flex-col gap-6 lg:flex">
          {/* Una etiqueta pequeña tipo "píldora" con el icono del crisol y un hilo decorativo al lado. */}
          <div className="inline-flex items-center gap-3 self-start">
            <span className="neo-raised inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-accent-cyan">
              <CrucibleGlyph className="size-4" /> IdeaForge AI · Guía para nuevas ideas
            </span>
            <FilamentBridgeGlyph className="h-4 w-16 text-accent-violet" />
          </div>

          {/* El titular grande. "text-gradient" pinta la frase "información real" con degradado de color. */}
          <h2 className="font-display text-4xl leading-[1.08] font-bold tracking-tight xl:text-5xl">
            Decide con más claridad usando <span className="text-gradient">información real</span>.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-slate-300">
            Cuéntanos una idea. Te ayudamos a organizarla, encontrar fuentes y ver qué conviene comprobar.
          </p>

          {/* La lista de los tres pasos. "map" dibuja una tarjeta por cada elemento de FACETS. */}
          <div className="grid gap-3.5">
            {FACETS.map(({ code, title: itemTitle, text, tone, status }) => (
              // "surface-panel" es una tarjeta sólida. "key={code}" es el nombre único de cada paso.
              <div key={code} className="surface-panel flex items-start gap-4 rounded-2xl p-4">
                {/* El sello de la etapa, en su color. "size-6" es su tamaño. */}
                <span className="neo-inset grid size-11 shrink-0 place-items-center rounded-xl">
                  <StageSealGlyph status={status} className={`size-6 ${tone}`} />
                </span>
                <div className="min-w-0">
                  {/* El código del paso, en letras pequeñas y espaciadas. */}
                  <p className="font-mono-tech text-[11px] font-semibold tracking-wider text-slate-400">{code}</p>
                  <h3 className="text-sm font-semibold">{itemTitle}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* La tarjeta del formulario. "animate-fade-up" hace que aparezca subiendo suavemente (animación de index.css). */}
        <div className="mx-auto w-full max-w-md animate-fade-up">
          <GlassPanel className="stage-3d rounded-3xl p-6 sm:p-8">
            {/* El título de la pantalla (es el h1 de la página, el encabezado principal). */}
            <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-300">{subtitle}</p>
            {/* Aquí va el formulario que la pantalla le pasó como "children". */}
            <div className="mt-6">{children}</div>
            {/* El pie con la línea separadora arriba ("border-t") y el enlace de cambio de pantalla. */}
            <div className="mt-5 border-t border-border pt-4 text-center text-sm text-slate-400">
              {footer}
            </div>
          </GlassPanel>
        </div>
      </main>
    </div>
  );
}
