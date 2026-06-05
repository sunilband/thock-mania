function buildFaviconHref(
  accent: string,
  kbDark: string,
  _kbLight: string,
  plate: string
): string {
  const a = accent.replace(/"/g, "'");
  const d = kbDark.replace(/"/g, "'");
  const pl = plate.replace(/"/g, "'");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">` +
    // background plate
    `<rect width="32" height="32" rx="7" fill="${pl}"/>` +
    // keycap shadow
    `<rect x="3" y="11" width="18" height="19" rx="4.5" fill="#000" fill-opacity="0.18"/>` +
    // keycap skirt
    `<rect x="3" y="9" width="18" height="19" rx="4.5" fill="${d}"/>` +
    // keycap top face (accent)
    `<rect x="5.5" y="6.5" width="13" height="13" rx="3" fill="${a}"/>` +
    // specular highlight
    `<rect x="7" y="8" width="10" height="2.5" rx="1.25" fill="#fff" fill-opacity="0.3"/>` +
    // sound waves (the "thock")
    `<path d="M22.5 11.5 Q26 16 22.5 20.5" stroke="${a}" stroke-width="2.1" stroke-linecap="round" fill="none"/>` +
    `<path d="M25.5 8.5 Q31 16 25.5 23.5" stroke="${a}" stroke-width="2.1" stroke-linecap="round" stroke-opacity="0.55" fill="none"/>` +
    "</svg>";

  return `data:image/svg+xml;base64,${globalThis.btoa(svg)}`;
}

/** Resolve a CSS custom property to a computed rgb/rgba string. */
function resolveColor(probe: HTMLElement, value: string): string | null {
  probe.style.backgroundColor = value;
  // Force style recalc by reading the computed value
  const resolved = getComputedStyle(probe).backgroundColor;
  return resolved && resolved !== "rgba(0, 0, 0, 0)" ? resolved : null;
}

function readThemeColors(): {
  accent: string;
  kbDark: string;
  kbLight: string;
  plate: string;
} | null {
  if (typeof document === "undefined" || !document.body) {
    return null;
  }

  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none";
  document.body.appendChild(probe);

  const accent = resolveColor(probe, "var(--primary)");
  const kbDark = resolveColor(probe, "var(--kb-dark, var(--muted-foreground))");
  const kbLight = resolveColor(probe, "var(--kb-light, var(--secondary))");
  const background = resolveColor(probe, "var(--background)");

  probe.remove();

  if (!(accent && background)) {
    return null;
  }

  return {
    accent,
    kbDark: kbDark ?? accent,
    kbLight: kbLight ?? background,
    plate: background,
  };
}

export function syncThockManiaFavicon() {
  if (typeof document === "undefined") {
    return;
  }

  const colors = readThemeColors();
  if (!colors) {
    return;
  }

  const href = buildFaviconHref(
    colors.accent,
    colors.kbDark,
    colors.kbLight,
    colors.plate
  );

  const selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]'] as const;
  let touched = false;
  for (const sel of selectors) {
    document.querySelectorAll<HTMLLinkElement>(sel).forEach((link) => {
      link.type = "image/svg+xml";
      link.href = href;
      touched = true;
    });
  }

  if (!touched) {
    const link = document.createElement("link");
    link.id = "thock-mania-favicon";
    link.rel = "shortcut icon";
    link.type = "image/svg+xml";
    link.href = href;
    document.head.prepend(link);
  }
}
