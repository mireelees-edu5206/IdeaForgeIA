import { describe, expect, it } from "vitest";

import { formatRelative } from "./formatDate";

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
