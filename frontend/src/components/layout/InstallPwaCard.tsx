import { useEffect, useState } from "react";
import { FiDownload, FiSmartphone } from "react-icons/fi";

import { Button } from "../ui/Button";
import { GlassPanel } from "../ui/GlassPanel";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallPwaCard() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const isIos =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !("MSStream" in window);

  useEffect(() => {
    const displayMode = window.matchMedia?.("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(displayMode?.matches ?? false);
    const onInstalled = () => setInstalled(true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    updateInstalled();
    displayMode?.addEventListener("change", updateInstalled);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      displayMode?.removeEventListener("change", updateInstalled);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch {
      setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  }

  if (installed || (!installPrompt && !isIos)) return null;

  return (
    <GlassPanel className="flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="neo-raised grid size-10 shrink-0 place-items-center rounded-xl text-accent-cyan">
          <FiSmartphone aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display font-semibold">IdeaForge en este dispositivo</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            {isIos
              ? "En Safari, toca Compartir y elige “Añadir a pantalla de inicio” para abrir el observatorio como una app."
              : "Instala la aplicación para abrirla desde tu pantalla de inicio y recuperar la interfaz cuando vuelvas a conectarte."}
          </p>
        </div>
      </div>
      {installPrompt && (
        <Button
          variant="secondary"
          size="sm"
          loading={installing}
          icon={<FiDownload aria-hidden="true" />}
          onClick={() => void install()}
        >
          Instalar app
        </Button>
      )}
    </GlassPanel>
  );
}
