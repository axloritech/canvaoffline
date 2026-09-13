import type { Background, Fill, Gradient, ImageElement, MaskKind, ShapeKind, Shadow, Glow } from "./types";

export function gradientCss(g: Gradient): string {
  const stops = g.stops.map((s) => `${s.color} ${s.pos}%`).join(", ");
  return g.type === "linear" ? `linear-gradient(${g.angle}deg, ${stops})` : `radial-gradient(circle at center, ${stops})`;
}

export function fillCss(f: Fill): string {
  return f.type === "gradient" ? gradientCss(f.gradient) : f.color;
}

export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function dropShadowFilter(shadow: Shadow, glow: Glow): string {
  const parts: string[] = [];
  if (shadow.enabled) parts.push(`drop-shadow(${shadow.x}px ${shadow.y}px ${shadow.blur}px ${hexToRgba(shadow.color, shadow.opacity)})`);
  if (glow.enabled) {
    parts.push(`drop-shadow(0 0 ${glow.blur}px ${hexToRgba(glow.color, glow.opacity)})`);
    parts.push(`drop-shadow(0 0 ${glow.blur / 2}px ${hexToRgba(glow.color, glow.opacity)})`);
  }
  return parts.join(" ");
}

export function textShadowCss(shadow: Shadow, glow: Glow): string {
  const parts: string[] = [];
  if (shadow.enabled) parts.push(`${shadow.x}px ${shadow.y}px ${shadow.blur}px ${hexToRgba(shadow.color, shadow.opacity)}`);
  if (glow.enabled) {
    parts.push(`0 0 ${glow.blur}px ${hexToRgba(glow.color, glow.opacity)}`);
    parts.push(`0 0 ${glow.blur * 2}px ${hexToRgba(glow.color, glow.opacity * 0.6)}`);
  }
  return parts.join(", ") || "none";
}

export function imageFilterCss(f: ImageElement["filters"]): string {
  const p: string[] = [];
  if (f.brightness !== 100) p.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) p.push(`contrast(${f.contrast}%)`);
  if (f.saturation !== 100) p.push(`saturate(${f.saturation}%)`);
  if (f.hue !== 0) p.push(`hue-rotate(${f.hue}deg)`);
  if (f.blur > 0) p.push(`blur(${f.blur}px)`);
  if (f.grayscale > 0) p.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia > 0) p.push(`sepia(${f.sepia}%)`);
  if (f.invert > 0) p.push(`invert(${f.invert}%)`);
  return p.join(" ") || "none";
}

// Shape polygons/paths in a 100x100 box
export function shapePath(kind: ShapeKind, w: number, h: number, radius = 0): string {
  const sx = w / 100, sy = h / 100;
  const P = (pts: [number, number][]) => "M" + pts.map(([x, y]) => `${x * sx},${y * sy}`).join("L") + "Z";
  const poly = (n: number, rot = -90) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = ((rot + (360 / n) * i) * Math.PI) / 180;
      pts.push([50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)]);
    }
    return P(pts);
  };
  switch (kind) {
    case "rect": return `M0,0H${w}V${h}H0Z`;
    case "rounded": {
      const r = Math.min(radius, w / 2, h / 2);
      return `M${r},0H${w - r}Q${w},0 ${w},${r}V${h - r}Q${w},${h} ${w - r},${h}H${r}Q0,${h} 0,${h - r}V${r}Q0,0 ${r},0Z`;
    }
    case "circle": case "ellipse": {
      const rx = w / 2, ry = h / 2;
      return `M${rx},0A${rx},${ry} 0 1,1 ${rx},${h}A${rx},${ry} 0 1,1 ${rx},0Z`;
    }
    case "triangle": return P([[50, 0], [100, 100], [0, 100]]);
    case "diamond": return P([[50, 0], [100, 50], [50, 100], [0, 50]]);
    case "pentagon": return poly(5);
    case "hexagon": return poly(6, 0);
    case "octagon": return poly(8, 22.5);
    case "star": {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 50 : 21;
        const a = ((-90 + 36 * i) * Math.PI) / 180;
        pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
      }
      return P(pts);
    }
    case "heart":
      return `M${50 * sx},${90 * sy}C${20 * sx},${65 * sy} ${0},${50 * sy} ${0},${30 * sy}C${0},${12 * sy} ${14 * sx},${2 * sy} ${27 * sx},${2 * sy}C${38 * sx},${2 * sy} ${46 * sx},${8 * sy} ${50 * sx},${18 * sy}C${54 * sx},${8 * sy} ${62 * sx},${2 * sy} ${73 * sx},${2 * sy}C${86 * sx},${2 * sy} ${100 * sx},${12 * sy} ${100 * sx},${30 * sy}C${100 * sx},${50 * sy} ${80 * sx},${65 * sy} ${50 * sx},${90 * sy}Z`;
    case "arrow-right": return P([[0, 30], [60, 30], [60, 5], [100, 50], [60, 95], [60, 70], [0, 70]]);
    case "arrow-left": return P([[100, 30], [40, 30], [40, 5], [0, 50], [40, 95], [40, 70], [100, 70]]);
    case "arrow-up": return P([[30, 100], [30, 40], [5, 40], [50, 0], [95, 40], [70, 40], [70, 100]]);
    case "arrow-down": return P([[30, 0], [30, 60], [5, 60], [50, 100], [95, 60], [70, 60], [70, 0]]);
    case "chevron": return P([[0, 0], [70, 0], [100, 50], [70, 100], [0, 100], [30, 50]]);
    case "speech": return P([[0, 0], [100, 0], [100, 75], [40, 75], [15, 100], [20, 75], [0, 75]]);
    case "cross": return P([[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]]);
    case "ring": {
      const rx = w / 2, ry = h / 2, ix = rx * 0.6, iy = ry * 0.6;
      return `M${rx},0A${rx},${ry} 0 1,1 ${rx},${h}A${rx},${ry} 0 1,1 ${rx},0Z M${rx},${ry - iy}A${ix},${iy} 0 1,0 ${rx},${ry + iy}A${ix},${iy} 0 1,0 ${rx},${ry - iy}Z`;
    }
    case "half-circle": return `M0,${h}A${w / 2},${h} 0 0,1 ${w},${h}Z`;
    case "parallelogram": return P([[25, 0], [100, 0], [75, 100], [0, 100]]);
    case "trapezoid": return P([[20, 0], [80, 0], [100, 100], [0, 100]]);
    case "blob":
      return `M${60 * sx},${4 * sy}C${80 * sx},${2 * sy} ${98 * sx},${20 * sy} ${97 * sx},${45 * sy}C${96 * sx},${70 * sy} ${85 * sx},${98 * sy} ${55 * sx},${97 * sy}C${25 * sx},${96 * sy} ${2 * sx},${80 * sy} ${3 * sx},${50 * sy}C${4 * sx},${20 * sy} ${35 * sx},${6 * sy} ${60 * sx},${4 * sy}Z`;
    default: return `M0,0H${w}V${h}H0Z`;
  }
}

export function maskClipPath(mask: MaskKind): string | undefined {
  switch (mask) {
    case "circle": return "ellipse(50% 50% at 50% 50%)";
    case "rounded": return "inset(0 round 12%)";
    case "star": return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
    case "heart": return "path('M0.5,0.9 C0.2,0.65 0,0.5 0,0.3 C0,0.12 0.14,0.02 0.27,0.02 C0.38,0.02 0.46,0.08 0.5,0.18 C0.54,0.08 0.62,0.02 0.73,0.02 C0.86,0.02 1,0.12 1,0.3 C1,0.5 0.8,0.65 0.5,0.9 Z')";
    case "hexagon": return "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
    case "diamond": return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
    case "triangle": return "polygon(50% 0%, 100% 100%, 0% 100%)";
    case "blob": return "polygon(60% 4%, 85% 12%, 97% 45%, 90% 80%, 55% 97%, 20% 90%, 3% 50%, 15% 15%)";
    default: return undefined;
  }
}

export function maskSvgPath(mask: MaskKind, w: number, h: number): string | null {
  const kindMap: Partial<Record<MaskKind, ShapeKind>> = {
    circle: "ellipse", rounded: "rounded", star: "star", heart: "heart", hexagon: "hexagon", diamond: "diamond", triangle: "triangle", blob: "blob",
  };
  const k = kindMap[mask];
  if (!k) return null;
  return shapePath(k, w, h, Math.min(w, h) * 0.12);
}

export function backgroundCss(bg: Background, assets: Record<string, string>): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (bg.type === "solid") style.background = bg.color;
  else if (bg.type === "gradient") style.background = gradientCss(bg.gradient);
  else if (bg.type === "image" && bg.assetId && assets[bg.assetId]) {
    style.backgroundImage = `url(${assets[bg.assetId]})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
    style.backgroundColor = bg.color;
  } else style.background = bg.color;
  return style;
}

export function patternSvgDataUrl(pattern: Background["pattern"], color: string, opacity: number): string | null {
  const c = hexToRgba(color, opacity);
  let svg = "";
  switch (pattern) {
    case "dots": svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='3' cy='3' r='2' fill='${c}'/></svg>`; break;
    case "grid": svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><path d='M40 0H0V40' fill='none' stroke='${c}' stroke-width='1'/></svg>`; break;
    case "lines": svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><path d='M0 10H20' stroke='${c}' stroke-width='2'/></svg>`; break;
    case "diagonal": svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><path d='M-5 5L5 -5M0 20L20 0M15 25L25 15' stroke='${c}' stroke-width='2'/></svg>`; break;
    default: return null;
  }
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

let noiseCache: string | null = null;
export function noiseDataUrl(): string {
  if (noiseCache) return noiseCache;
  if (typeof document === "undefined") return "";
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseCache = c.toDataURL();
  return noiseCache;
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const round = (v: number, d = 0) => { const p = 10 ** d; return Math.round(v * p) / p; };

export function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number) {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const dx = px - cx, dy = py - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}
