/**
 * ARCHIVO: InstallPwaCard.tsx
 *
 * ¿Qué es?
 * Es una tarjeta que invita a instalar IdeaForge en el celular o la computadora, como si fuera
 * una app más. Es la "tarjeta de instalación" que aparece en la pantalla de configuración.
 *
 * ¿Para qué sirve?
 * IdeaForge es una PWA (Progressive Web App): una página web que puede instalarse y abrirse
 * desde el escritorio o la pantalla de inicio. Esta tarjeta:
 * - En Android y computadoras: muestra el botón "Instalar app" cuando el navegador lo permite.
 * - En iPhone/iPad: no puede instalar sola, así que explica los pasos (Compartir → Añadir a inicio).
 * - Si la app ya está instalada, no muestra nada.
 *
 * ¿Quién lo usa?
 * SettingsPage.tsx (la pantalla de configuración).
 *
 * Nota: el navegador manda un evento llamado "beforeinstallprompt" cuando puede instalar la app.
 * Lo guardamos y lo usamos cuando la persona pulsa el botón.
 */

/* "useEffect" conecta escuchadores cuando aparece la tarjeta; "useState" guarda valores que cambian. */
import { useEffect, useState } from "react";
/* Dos iconos: flecha hacia abajo (instalar) y celular (dispositivo). */
import { FiDownload, FiSmartphone } from "react-icons/fi";

/* El botón estándar de la app. */
import { Button } from "../ui/Button";
/* La tarjeta de cristal que envuelve el contenido. */
import { GlassPanel } from "../ui/GlassPanel";

/**
 * InstallPromptEvent describe el evento de instalación que manda el navegador:
 * - prompt(): muestra la ventana oficial para instalar la app. Devuelve una promesa (algo que se completará más tarde).
 * - userChoice: dice si la persona aceptó ("accepted") o rechazó ("dismissed").
 * "extends Event" significa que es un evento normal del navegador con esas dos funciones extra.
 */
/** Contrato de datos InstallPromptEvent utilizado por interfaz compartida. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * InstallPwaCard decide si mostrar la tarjeta y qué mensaje o botón poner.
 *
 * Cómo se usa: <InstallPwaCard />  (no recibe datos)
 */
/** Expone la funcion install pwa card para el flujo de shared frontend. */
export function InstallPwaCard() {
  // "installPrompt" guarda el evento de instalación del navegador (o null si todavía no llegó).
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  // "installed" dice si la app ya está instalada y se abre en modo ventana propia.
  const [installed, setInstalled] = useState(false);
  // "installing" es true mientras se está ejecutando la instalación (para mostrar la carga en el botón).
  const [installing, setInstalling] = useState(false);
  // "isIos" dice si el dispositivo es iPhone, iPad o iPod. Esos navegadores no tienen botón de instalar.
  // La comprobación "typeof navigator" evita errores si el código corre en un lugar sin navegador.
  // La expresión regular /iphone|ipad|ipod/i busca esas palabras en el texto que identifica al navegador.
  // "!('MSStream' in window)" descarta un caso raro de Windows Phone que también diría "iPhone" por error.
  const isIos =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !("MSStream" in window);

  // Este bloque se ejecuta una vez al mostrar la tarjeta. Prepara los avisos del navegador.
  useEffect(() => {
    // "matchMedia" pregunta: "¿la app se está mostrando en modo instalado?" (display-mode standalone).
    // El "?." significa que si el navegador no tiene matchMedia, no se rompe.
    const displayMode = window.matchMedia?.("(display-mode: standalone)");
    // Revisa si ya está instalada y guarda la respuesta.
    const updateInstalled = () => setInstalled(displayMode?.matches ?? false);
    // Se ejecuta cuando la app acaba de instalarse.
    const onInstalled = () => setInstalled(true);
    // Se ejecuta cuando el navegador dice "puedo instalar esta app". Guardamos el evento para usarlo luego.
    const onPrompt = (event: Event) => {
      // "preventDefault" evita que el navegador muestre su propio aviso enseguida: lo mostraremos nosotros, en el momento que la persona elija.
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    // Revisamos al inicio si ya está instalada.
    updateInstalled();
    // Si cambia el modo de visualización (por ejemplo, se abre desde el icono), volvemos a revisar.
    displayMode?.addEventListener("change", updateInstalled);
    // Escuchamos el aviso de "puedo instalarme".
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Escuchamos el aviso de "ya me instalé".
    window.addEventListener("appinstalled", onInstalled);
    // La función que devuelve el efecto es la limpieza: quita los escuchadores cuando la tarjeta desaparece.
    // Así no quedan avisos "colgados" que sigan activos sin necesidad.
    return () => {
      displayMode?.removeEventListener("change", updateInstalled);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /**
   * install se ejecuta al pulsar "Instalar app". Muestra la ventana oficial del navegador.
   * La palabra "async" permite esperar a que la persona decida.
   */
  async function install() {
    // Si no tenemos el evento guardado, no hay nada que instalar.
    if (!installPrompt) return;
    // Mostramos la carga en el botón.
    setInstalling(true);
    // "try" intenta instalar; si algo falla, "catch" lo atrapa para que la app no se rompa.
    try {
      // Mostramos la ventana oficial y esperamos a que la persona responda.
      await installPrompt.prompt();
      // Esperamos su respuesta (aceptó o no). No la guardamos porque la tarjeta se oculta de todos modos al instalarse.
      await installPrompt.userChoice;
      // Como el evento solo se puede usar una vez, lo quitamos.
      setInstallPrompt(null);
    } catch {
      // Si falló, también quitamos el evento para no volver a intentar algo que ya no funciona.
      setInstallPrompt(null);
    } finally {
      // "finally" se ejecuta siempre (haya funcionado o no): quitamos la carga del botón.
      setInstalling(false);
    }
  }

  // Si ya está instalada, o si no hay forma de instalar (no hay evento y tampoco es iPhone), no mostramos nada.
  // "return null" significa "no dibujes nada".
  if (installed || (!installPrompt && !isIos)) return null;

  return (
    // Tarjeta de cristal. En celulares el texto y el botón van uno sobre otro; en pantallas grandes, en fila.
    <GlassPanel className="flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {/* El icono de celular dentro de un cuadrito levantado. */}
        <span className="neo-raised grid size-10 shrink-0 place-items-center rounded-xl text-accent-cyan">
          <FiSmartphone aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display font-semibold">IdeaForge en este dispositivo</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            {/* En iPhone/iPad damos los pasos manuales. En los demás casos invitamos a instalar. */}
            {isIos
              ? "En Safari, toca Compartir y elige “Añadir a pantalla de inicio” para abrir el observatorio como una app."
              : "Instala la aplicación para abrirla desde tu pantalla de inicio y recuperar la interfaz cuando vuelvas a conectarte."}
          </p>
        </div>
      </div>
      {/* El botón de instalar solo aparece si el navegador ya nos dio el evento. En iPhone no aparece nunca, porque no existe. */}
      {installPrompt && (
        <Button
          variant="secondary"
          size="sm"
          // Mientras instala, muestra la ruedita y no deja tocarlo otra vez.
          loading={installing}
          icon={<FiDownload aria-hidden="true" />}
          // "void" descarta la promesa que devuelve install(), porque aquí no necesitamos esperar su resultado.
          onClick={() => void install()}
        >
          Instalar app
        </Button>
      )}
    </GlassPanel>
  );
}
