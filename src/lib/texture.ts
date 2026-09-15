/**
 * Procedural texture & film effects. Every texture is generated locally as a seamless tile
 * (seeded, so it is deterministic per element and identical in the editor and in exports).
 */
import type { Texture, TextureKind } from "./types";

export const TEXTURE_GROUPS: { title: string; items: { id: TextureKind; label: string }[] }[] = [
  { title: "Film", items: [
    { id: "film-grain", label: "Film Grain" }, { id: "fine-grain", label: "Fine Grain" }, { id: "heavy-grain", label: "Heavy Grain" },
    { id: "vintage-grain", label: "Vintage Grain" }, { id: "analog-film", label: "Analog Film" }, { id: "film-dust", label: "Film Dust" }, { id: "film-scratches", label: "Film Scratches" },
  ] },
  { title: "Paper & canvas", items: [
    { id: "paper-grain", label: "Paper Grain" }, { id: "paper-texture", label: "Paper Texture" }, { id: "canvas-texture", label: "Canvas Texture" },
  ] },
  { title: "Noise", items: [
    { id: "noise", label: "Noise" }, { id: "color-noise", label: "Color Noise" }, { id: "digital-noise", label: "Digital Noise" },
  ] },
  { title: "Print", items: [
    { id: "halftone", label: "Halftone Dots" }, { id: "print-dots", label: "Print Dots" }, { id: "retro-print", label: "Retro Print" },
    { id: "newspaper", label: "Newspaper Print" }, { id: "risograph", label: "Risograph Texture" },
  ] },
];
export const TEXTURE_LABEL: Record<TextureKind, string> = Object.fromEntries(TEXTURE_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.label]))) as any;

export const BLEND_MODES = ["overlay", "soft-light", "multiply", "screen", "normal", "hard-light", "difference", "luminosity", "color-burn", "color-dodge"] as const;

/** sensible defaults per texture kind */
export function defaultTexture(kind: TextureKind = "film-grain"): Texture {
  const base: Texture = { enabled: true, kind, intensity: 60, size: 50, scale: 100, opacity: 60, blend: "overlay", randomness: 50, color: "#ffffff", seed: Math.floor(Math.random() * 1e6) };
  const per: Partial<Record<TextureKind, Partial<Texture>>> = {
    "fine-grain": { size: 25, intensity: 45, opacity: 50 },
    "heavy-grain": { size: 80, intensity: 90, opacity: 75 },
    "vintage-grain": { color: "#e8c9a0", blend: "soft-light", opacity: 70, intensity: 70 },
    "analog-film": { color: "#d9b38c", blend: "soft-light", opacity: 65 },
    "film-dust": { color: "#ffffff", blend: "screen", opacity: 80, intensity: 50, size: 40 },
    "film-scratches": { color: "#ffffff", blend: "screen", opacity: 70, intensity: 40, size: 40 },
    "paper-grain": { color: "#000000", blend: "multiply", opacity: 35, intensity: 50 },
    "paper-texture": { color: "#000000", blend: "multiply", opacity: 40, size: 60 },
    "canvas-texture": { color: "#000000", blend: "multiply", opacity: 45, size: 50 },
    "noise": { blend: "overlay", opacity: 50 },
    "color-noise": { blend: "overlay", opacity: 55, intensity: 70 },
    "digital-noise": { blend: "screen", opacity: 45, size: 35 },
    "halftone": { color: "#000000", blend: "multiply", opacity: 80, size: 50, intensity: 55 },
    "print-dots": { color: "#000000", blend: "multiply", opacity: 60, size: 35, intensity: 45 },
    "retro-print": { color: "#1c2b5a", blend: "multiply", opacity: 60, size: 55 },
    "newspaper": { color: "#000000", blend: "multiply", opacity: 70, size: 45, intensity: 60 },
    "risograph": { color: "#e11d2e", blend: "multiply", opacity: 60, size: 55, intensity: 65 },
  };
  return { ...base, ...(per[kind] ?? {}) };
}

/* ---------- seeded PRNG + helpers ---------- */
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hexRgb(h: string): [number, number, number] { const m = h.replace("#", ""); const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
/** value-noise (tileable) */
function valueNoise(rand: () => number, n: number) {
  const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = rand();
  return (x: number, y: number, freq: number) => {
    // cells per 256px tile must be an integer so the tile wraps seamlessly
    const cells = Math.max(1, Math.round(256 * freq));
    const fx = (((x / 256) * cells) % n + n) % n, fy = (((y / 256) * cells) % n + n) % n;
    const wrap = Math.min(n, Math.max(1, Math.round(256 * freq)));
    const x0 = Math.floor(fx) % wrap, y0 = Math.floor(fy) % wrap, x1 = (x0 + 1) % wrap, y1 = (y0 + 1) % wrap;
    const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g[y0 * n + x0], b = g[y0 * n + x1], c = g[y1 * n + x0], d = g[y1 * n + x1];
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  };
}

const cache = new Map<string, HTMLCanvasElement>();
export function textureKey(t: Texture) { return [t.kind, t.size, t.intensity, t.randomness, t.color, t.seed].join("|"); }

/** Generates (and caches) the seamless tile for a texture. Tile size 256 (512 for structured print textures). */
export function textureTile(t: Texture): HTMLCanvasElement {
  const key = textureKey(t);
  const hit = cache.get(key); if (hit) return hit;
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  const S = 256;
  const c = document.createElement("canvas"); c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  const rand = mulberry32(t.seed + 1);
  const img = ctx.createImageData(S, S); const d = img.data;
  const [cr, cg, cb] = hexRgb(t.color);
  const I = t.intensity / 100, R = t.randomness / 100, sz = t.size / 100; // 0..1
  const grainPx = Math.max(1, Math.round(1 + sz * 5)); // grain cell size in px
  const put = (i: number, v: number, a: number, rgb?: [number, number, number]) => { const [r, g, b] = rgb ?? [cr, cg, cb]; d[i] = r * v + (1 - v) * 0; d[i + 1] = g * v; d[i + 2] = b * v; d[i + 3] = Math.max(0, Math.min(255, a * 255)); };
  const grainField = (cellIn: number, sharp: number) => {
    let cell = cellIn;
    // blocky random field with optional smoothing; returns 0..1 with mean .5
    while (S % cell !== 0 && cell > 1) cell--;
    const n = Math.ceil(S / cell), g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return (x: number, y: number) => {
      const gx = Math.floor(x / cell) % n, gy = Math.floor(y / cell) % n;
      let v = g[gy * n + gx];
      if (sharp < 1) { const nb = g[gy * n + ((gx + 1) % n)] + g[((gy + 1) % n) * n + gx]; v = v * sharp + ((nb / 2) * (1 - sharp)); }
      return v;
    };
  };
  const kind = t.kind;
  const grainy = (cell: number, contrast: number, tint = false, mono = true) => {
    const f = grainField(cell, 0.6 + 0.4 * R);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4; const v = f(x, y);
      const dev = (v - 0.5) * 2 * contrast * I; // -1..1
      const lum = 0.5 + dev * 0.5;
      if (mono) {
        const rgb: [number, number, number] = tint ? [cr, cg, cb] : [255, 255, 255];
        // overlay-friendly: grey around 50%, colored towards texture colour
        d[i] = rgb[0] * lum; d[i + 1] = rgb[1] * lum; d[i + 2] = rgb[2] * lum; d[i + 3] = 255;
      } else {
        d[i] = 128 + dev * 127 * (rand() > 0.5 ? 1 : -1); d[i + 1] = 128 + (rand() - 0.5) * 254 * contrast * I; d[i + 2] = 128 + (rand() - 0.5) * 254 * contrast * I; d[i + 3] = 255;
      }
    }
  };
  switch (kind) {
    case "film-grain": grainy(grainPx, 0.9, false); break;
    case "fine-grain": grainy(1, 0.7, false); break;
    case "heavy-grain": grainy(grainPx + 2, 1.3, false); break;
    case "vintage-grain": grainy(grainPx, 0.9, true); break;
    case "analog-film": {
      grainy(grainPx, 0.7, true);
      // subtle horizontal luminance bands (analog rolling)
      for (let y = 0; y < S; y++) { const band = 0.06 * I * Math.sin((y / S) * Math.PI * (2 + R * 6) + t.seed); for (let x = 0; x < S; x++) { const i = (y * S + x) * 4; d[i] += band * 255; d[i + 1] += band * 255; d[i + 2] += band * 255; } }
      break;
    }
    case "noise": grainy(1, 1.0, false); break;
    case "color-noise": grainy(grainPx, 1.0, false, false); break;
    case "digital-noise": {
      // sparse bright pixels & short horizontal glitches
      for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 0; }
      const count = Math.floor(S * S * 0.03 * I * (0.5 + sz));
      for (let k = 0; k < count; k++) { const x = Math.floor(rand() * S), y = Math.floor(rand() * S); const len = rand() < 0.15 * R ? Math.floor(rand() * 20 * sz) + 1 : 1; for (let j = 0; j < len && x + j < S; j++) { const i = (y * S + x + j) * 4; put(i, 1, 0.5 + rand() * 0.5); } }
      break;
    }
    case "film-dust": case "film-scratches": {
      for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 0; }
      ctx.putImageData(img, 0, 0);
      ctx.fillStyle = t.color; ctx.strokeStyle = t.color;
      if (kind === "film-dust") {
        const n = Math.floor(20 + I * 120 * (0.4 + R));
        for (let k = 0; k < n; k++) { const x = rand() * S, y = rand() * S, r = (0.4 + rand() * 1.6) * (0.4 + sz * 1.6); ctx.globalAlpha = 0.35 + rand() * 0.65; ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.6 + rand() * 0.6), rand() * Math.PI, 0, Math.PI * 2); ctx.fill(); }
        // a few hair fibres
        for (let k = 0; k < Math.floor(2 + I * 6); k++) { ctx.globalAlpha = 0.5 + rand() * 0.4; ctx.lineWidth = 0.6 + sz; ctx.beginPath(); let x = rand() * S, y = rand() * S; ctx.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (rand() - 0.5) * 18; y += (rand() - 0.5) * 18; ctx.lineTo(x, y); } ctx.stroke(); }
      } else {
        const n = Math.floor(2 + I * 14 * (0.5 + R));
        for (let k = 0; k < n; k++) { const x = rand() * S; ctx.globalAlpha = 0.25 + rand() * 0.7; ctx.lineWidth = 0.5 + rand() * 1.5 * (0.5 + sz); const y0 = rand() < 0.6 ? 0 : rand() * S, y1 = rand() < 0.6 ? S : rand() * S; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + (rand() - 0.5) * 3 * R, y1); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      cache.set(key, c); return c;
    }
    case "paper-grain": {
      const vn = valueNoise(rand, 64);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4; const v = vn(x, y, (0.35 - sz * 0.25)) * 0.6 + rand() * 0.4 * (0.5 + R); const lum = 0.5 + (v - 0.5) * I; put(i, 1, 1, [255 * lum, 255 * lum, 255 * lum]); d[i + 3] = 255; }
      break;
    }
    case "paper-texture": {
      const vn = valueNoise(rand, 32), vn2 = valueNoise(rand, 96);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4; const f = (0.12 - sz * 0.08); const v = vn(x, y, f) * 0.55 + vn2(x, y, f * 4) * 0.3 + rand() * 0.15 * R; const lum = 0.5 + (v - 0.5) * I * 1.4; d[i] = d[i + 1] = d[i + 2] = 255 * lum; d[i + 3] = 255; }
      break;
    }
    case "canvas-texture": {
      let period = Math.max(2, Math.round(2 + sz * 5)); while (S % period !== 0) period--;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const wx = Math.sin((x / period) * Math.PI) ** 2, wy = Math.sin((y / period) * Math.PI) ** 2;
        const weave = ((Math.floor(x / period) + Math.floor(y / period)) % 2 === 0) ? wx : wy;
        const v = 0.5 + (weave - 0.5) * I * 0.9 + (rand() - 0.5) * 0.25 * R;
        d[i] = d[i + 1] = d[i + 2] = 255 * v; d[i + 3] = 255;
      }
      break;
    }
    case "halftone": case "print-dots": case "retro-print": case "newspaper": case "risograph": {
      for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 0; }
      ctx.putImageData(img, 0, 0);
      ctx.fillStyle = t.color;
      const cell = Math.max(3, Math.round(3 + sz * 13));
      const angle = kind === "newspaper" ? Math.PI / 4 : kind === "retro-print" ? Math.PI / 8 : kind === "risograph" ? Math.PI / 6 : 0;
      const vn = valueNoise(rand, 16);
      ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(angle); ctx.translate(-S / 2, -S / 2);
      const ext = S * 0.75;
      for (let y = -ext; y < S + ext; y += cell) for (let x = -ext; x < S + ext; x += cell) {
        // dot radius from low-frequency noise (simulated tone) + intensity
        let tone = 0.35 + 0.65 * vn(((x % S) + S) % S, ((y % S) + S) % S, 0.03);
        if (kind === "print-dots") tone = 0.5;
        let r = (cell / 2) * tone * (0.35 + I * 0.75);
        if (kind === "risograph") r *= 0.5 + rand() * 0.9;
        r += (rand() - 0.5) * cell * 0.25 * R;
        if (r <= 0.3) continue;
        const jx = (rand() - 0.5) * cell * 0.4 * R, jy = (rand() - 0.5) * cell * 0.4 * R;
        ctx.globalAlpha = kind === "risograph" ? 0.5 + rand() * 0.5 : kind === "retro-print" ? 0.75 : 1;
        ctx.beginPath();
        if (kind === "newspaper") ctx.rect(x + jx - r * 0.8, y + jy - r * 0.8, r * 1.6, r * 1.6); else ctx.arc(x + jx, y + jy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (kind === "risograph" || kind === "retro-print") {
        // add ink speckle
        ctx.globalAlpha = 0.6; const n = Math.floor(S * S * 0.01 * I);
        for (let k = 0; k < n; k++) ctx.fillRect(rand() * S, rand() * S, 1, 1);
      }
      ctx.globalAlpha = 1;
      cache.set(key, c); return c;
    }
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, c); return c;
}

/** CSS for an overlay div (editor) */
export function textureStyle(t: Texture, elementScaleHint = 1): React.CSSProperties {
  const tile = textureTile(t);
  const px = Math.round(256 * (t.scale / 100) * elementScaleHint);
  return { position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `url(${tile.toDataURL()})`, backgroundSize: `${px}px ${px}px`, opacity: t.opacity / 100, mixBlendMode: t.blend as any };
}

/** Draw onto a 2D context inside a rect (export) */
export function drawTexture(ctx: CanvasRenderingContext2D, t: Texture, W: number, H: number, renderScale: number, clip?: Path2D) {
  if (!t.enabled || t.opacity <= 0) return;
  const tile = textureTile(t);
  const pat = ctx.createPattern(tile, "repeat"); if (!pat) return;
  const k = (t.scale / 100) * renderScale;
  ctx.save();
  if (clip) ctx.clip(clip);
  ctx.globalAlpha = t.opacity / 100;
  ctx.globalCompositeOperation = (t.blend === "normal" ? "source-over" : t.blend) as GlobalCompositeOperation;
  const m = new DOMMatrix().scale(k, k); pat.setTransform(m);
  ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
