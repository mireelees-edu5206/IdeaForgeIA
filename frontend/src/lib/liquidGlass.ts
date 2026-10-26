/**
 * Efecto interactivo de Cristal Líquido (Liquid Glass):
 * - Al hacer clic en botones o controles `.jelly`, genera ondas concéntricas
 *   (olas líquidas) aceleradas por GPU desde el punto exacto del clic.
 */

const WAVE_TARGET_SELECTOR =
  'button:not(:disabled), a.jelly, [role="button"]:not([aria-disabled="true"])';
const MAX_ACTIVE_RIPPLES = 2;

let initialized = false;
let lastPointerDownAt = 0;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function spawnLiquidWaves(
  element: HTMLElement,
  clientX?: number,
  clientY?: number,
): void {
  if (prefersReducedMotion()) return;

  const existing = element.querySelectorAll(".liquid-ripple");
  if (existing.length >= MAX_ACTIVE_RIPPLES) {
    existing[0]?.remove();
  }

  const rect = element.getBoundingClientRect();
  const width = rect.width || element.offsetWidth || 120;
  const height = rect.height || element.offsetHeight || 44;

  const hasCoords =
    typeof clientX === "number" &&
    typeof clientY === "number" &&
    (clientX !== 0 || clientY !== 0) &&
    rect.width > 0 &&
    rect.height > 0;

  const x = hasCoords ? clientX - rect.left : width / 2;
  const y = hasCoords ? clientY - rect.top : height / 2;
  const maxRadius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const size = Math.round(Math.max(maxRadius * 2.2, Math.max(width, height) * 1.8, 92));

  element.classList.add("liquid-host", "is-liquid-waving");

  const ripple = document.createElement("span");
  ripple.className = "liquid-ripple";
  ripple.setAttribute("aria-hidden", "true");
  ripple.setAttribute("data-liquid-wave", "true");
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${Math.round(x)}px`;
  ripple.style.top = `${Math.round(y)}px`;

  const drop = document.createElement("span");
  drop.className = "liquid-ripple__drop";

  const wave1 = document.createElement("span");
  wave1.className = "liquid-ripple__wave liquid-ripple__wave--1";

  const wave2 = document.createElement("span");
  wave2.className = "liquid-ripple__wave liquid-ripple__wave--2";

  const wave3 = document.createElement("span");
  wave3.className = "liquid-ripple__wave liquid-ripple__wave--3";

  ripple.append(drop, wave1, wave2, wave3);
  element.appendChild(ripple);

  const cleanup = () => {
    ripple.remove();
    if (!element.querySelector(".liquid-ripple")) {
      element.classList.remove("is-liquid-waving");
    }
  };

  wave3.addEventListener("animationend", cleanup, { once: true });
  const timer = setTimeout(cleanup, 1000);
  (timer as unknown as { unref?: () => void }).unref?.();
}

function handlePointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const interactive = target.closest<HTMLElement>(WAVE_TARGET_SELECTOR);
  if (!interactive) return;
  lastPointerDownAt = Date.now();
  spawnLiquidWaves(interactive, event.clientX, event.clientY);
}

function handleClick(event: MouseEvent): void {
  if (Date.now() - lastPointerDownAt < 420) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const interactive = target.closest<HTMLElement>(WAVE_TARGET_SELECTOR);
  if (!interactive) return;
  spawnLiquidWaves(interactive, event.clientX, event.clientY);
}

export function initLiquidGlass(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  window.addEventListener("click", handleClick, { passive: true });
}
