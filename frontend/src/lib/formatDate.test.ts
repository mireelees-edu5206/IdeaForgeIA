import { describe, expect, it } from "vitest";

import { formatRelative } from "./formatDate";
import { initLiquidGlass } from "./liquidGlass";

describe("formatRelative", () => {
  const now = new Date("2026-09-24T12:00:00Z");

  it.each([
    ["2026-09-24T11:59:30Z", "hace un momento"],
    ["2026-09-24T11:55:00Z", "hace 5 minutos"],
    ["2026-09-24T09:00:00Z", "hace 3 horas"],
    ["2026-09-23T12:00:00Z", "ayer"],
  ])("%s → %s", (iso, expected) => {
    expect(formatRelative(iso, now)).toBe(expected);
  });
});

describe("liquidGlass", () => {
  it("genera 3 ondas líquidas concéntricas al hacer clic en un botón", () => {
    initLiquidGlass();
    const button = document.createElement("button");
    button.textContent = "Explorar";
    document.body.appendChild(button);

    button.click();

    const ripple = button.querySelector(".liquid-ripple");
    expect(ripple).not.toBeNull();
    expect(button.querySelectorAll(".liquid-ripple__wave")).toHaveLength(3);
    expect(button.querySelector(".liquid-ripple__drop")).not.toBeNull();

    button.querySelector(".liquid-ripple__wave--3")?.dispatchEvent(new Event("animationend"));
    expect(button.querySelector(".liquid-ripple")).toBeNull();
    button.remove();
  });
});
