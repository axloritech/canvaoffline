/*
 * Local "Import & Edit" analyzer.
 * Converts a flat PNG/JPG design into editable layers: background, shapes, images and text.
 * Everything runs in the browser (Canvas 2D + Tesseract.js WASM served from /public/ocr).
 */
import type { Project, DesignElement, Background, Gradient } from "./types";
import { newProject, newText, newShape, newImage, uid, solidFill } from "./defaults";
import { FONTS } from "./fonts";

export interface AnalyzeOptions {
  debug?: boolean;
  ocr: boolean;
  detectShapes: boolean;
  language?: string;
  onProgress?: (stage: string, pct: number) => void;
}
export interface AnalyzeStats { texts: number; images: number; shapes: number; bgType: string; ms: number }

type RGB = [number, number, number];
const dist = (a: RGB, b: RGB) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
const hex = (c: RGB) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/* ------------------------------------------------------------------ */
/* Pixel helpers                                                        */
/* ------------------------------------------------------------------ */
class Img {
  w: number; h: number; d: Uint8ClampedArray;
  constructor(public canvas: HTMLCanvasElement) {
    this.w = canvas.width; this.h = canvas.height;
    this.d = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, this.w, this.h).data;
  }
  px(x: number, y: number): RGB { const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2]]; }
  alpha(x: number, y: number) { return this.d[(y * this.w + x) * 4 + 3]; }
}

function quantize(c: RGB, step = 12): string { return c.map((v) => Math.round(v / step) * step).join(","); }

function dominantColor(samples: RGB[], step = 12): { color: RGB; share: number } {
  const map = new Map<string, { n: number; sum: RGB }>();
  for (const s of samples) {
    const k = quantize(s, step);
    const e = map.get(k) ?? { n: 0, sum: [0, 0, 0] };
    e.n++; e.sum[0] += s[0]; e.sum[1] += s[1]; e.sum[2] += s[2];
    map.set(k, e);
  }
  let best: { n: number; sum: RGB } | null = null;
  map.forEach((e) => { if (!best || e.n > best.n) best = e; });
  const b = best!;
  return { color: [b.sum[0] / b.n, b.sum[1] / b.n, b.sum[2] / b.n], share: b.n / samples.length };
}

/* ------------------------------------------------------------------ */
/* Background                                                           */
/* ------------------------------------------------------------------ */
interface BgModel {
  kind: "solid" | "gradient" | "image";
  colorAt: (x: number, y: number) => RGB;
  background: Background;
  tolerance: number;
}

function analyzeBackground(img: Img): BgModel {
  const { w, h } = img;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 200));
  const border: RGB[] = [];
  for (let x = 0; x < w; x += step) { border.push(img.px(x, 0), img.px(x, h - 1)); }
  for (let y = 0; y < h; y += step) { border.push(img.px(0, y), img.px(w - 1, y)); }
  const all: RGB[] = [];
  for (let y = 0; y < h; y += step * 2) for (let x = 0; x < w; x += step * 2) all.push(img.px(x, y));
  const domBorder = dominantColor(border, 16);
  const domAll = dominantColor(all, 16);

  // Solid: border strongly one color, and that color is common overall (and quantised buckets don't hide a soft gradient)
  const cornerSpread = Math.max(dist(img.px(1, 1), img.px(w - 2, h - 2)), dist(img.px(w - 2, 1), img.px(1, h - 2)));
  if (domBorder.share > 0.6 && dist(domBorder.color, domAll.color) < 30 && cornerSpread < 10) {
    const c = domBorder.color;
    return { kind: "solid", colorAt: () => c, tolerance: 28, background: { type: "solid", color: hex(c), gradient: defaultGrad(), noise: 0, pattern: "none", patternColor: "#000000", patternOpacity: 0.08 } };
  }

  // Gradient: check vertical & horizontal profiles along the edges for smooth monotone change
  const prof = (axis: "x" | "y") => {
    const n = 24, out: RGB[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const samples: RGB[] = [];
      if (axis === "y") { const y = Math.round(t * (h - 1)); for (const xx of [2, Math.round(w * 0.05), w - 3, Math.round(w * 0.95)]) samples.push(img.px(Math.min(w - 1, Math.max(0, xx)), y)); }
      else { const x = Math.round(t * (w - 1)); for (const yy of [2, Math.round(h * 0.05), h - 3, Math.round(h * 0.95)]) samples.push(img.px(x, Math.min(h - 1, Math.max(0, yy)))); }
      out.push(dominantColor(samples, 8).color);
    }
    return out;
  };
  const smoothness = (p: RGB[]) => {
    // total variation vs endpoint difference: a clean gradient has TV ≈ |end-start|
    let tv = 0; for (let i = 1; i < p.length; i++) tv += dist(p[i], p[i - 1]);
    const end = dist(p[0], p[p.length - 1]);
    return { tv, end, ratio: end > 8 ? tv / end : 0 };
  };
  const py = prof("y"), px = prof("x");
  const sy = smoothness(py), sx = smoothness(px);
  const pick = sy.end >= sx.end ? { axis: "y" as const, p: py, s: sy } : { axis: "x" as const, p: px, s: sx };
  if (pick.s.end > 8 && pick.s.ratio > 0 && pick.s.ratio < 1.6) {
    const a = pick.p[0], b = pick.p[pick.p.length - 1];
    const mid = pick.p[Math.floor(pick.p.length / 2)];
    const stops = [{ color: hex(a), pos: 0 }, { color: hex(b), pos: 100 }];
    // add a middle stop if the gradient is not linear in color space
    const lin: RGB = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    if (dist(lin, mid) > 18) stops.splice(1, 0, { color: hex(mid), pos: 50 });
    const gradient: Gradient = { type: "linear", angle: pick.axis === "y" ? 180 : 90, stops };
    const colorAt = (x: number, y: number): RGB => {
      const t = pick.axis === "y" ? y / (h - 1) : x / (w - 1);
      const i = Math.min(pick.p.length - 2, Math.floor(t * (pick.p.length - 1)));
      const f = t * (pick.p.length - 1) - i;
      const c0 = pick.p[i], c1 = pick.p[i + 1];
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    };
    return { kind: "gradient", colorAt, tolerance: 34, background: { type: "gradient", color: hex(a), gradient, noise: 0, pattern: "none", patternColor: "#000000", patternOpacity: 0.08 } };
  }

  if (domBorder.share > 0.6 && dist(domBorder.color, domAll.color) < 30) {
    const c = domBorder.color;
    return { kind: "solid", colorAt: () => c, tolerance: 28, background: { type: "solid", color: hex(c), gradient: defaultGrad(), noise: 0, pattern: "none", patternColor: "#000000", patternOpacity: 0.08 } };
  }
  // Photo / complex background: we keep the whole (text-inpainted) image as background
  const c = domAll.color;
  return { kind: "image", colorAt: () => c, tolerance: 0, background: { type: "image", color: hex(c), gradient: defaultGrad(), noise: 0, pattern: "none", patternColor: "#000000", patternOpacity: 0.08 } };
}
const defaultGrad = (): Gradient => ({ type: "linear", angle: 90, stops: [{ color: "#e11d2e", pos: 0 }, { color: "#ff8a5b", pos: 100 }] });

/* ------------------------------------------------------------------ */
/* OCR                                                                  */
/* ------------------------------------------------------------------ */
export interface OcrLine {
  color?: RGB; text: string; x0: number; y0: number; x1: number; y1: number; conf: number; words: { text: string; x0: number; y0: number; x1: number; y1: number; conf: number }[] }
interface OcrBlock { lines: OcrLine[]; x0: number; y0: number; x1: number; y1: number }

let workerPromise: Promise<any> | null = null;
async function getWorker(lang: string, onProgress?: (s: string, p: number) => void) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import("tesseract.js");
      const w = await createWorker(lang, OEM.LSTM_ONLY, {
        workerPath: "/ocr/worker.min.js", corePath: "/ocr/core", langPath: "/ocr/lang", gzip: true,
        cacheMethod: "readOnly" as any, legacyCore: false, legacyLang: false,
        logger: (m: any) => { if (onProgress && typeof m.progress === "number") onProgress(m.status, m.progress); },
      } as any);
      return w;
    })();
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

async function runOcr(canvas: HTMLCanvasElement, bg: BgModel, lang: string, onProgress?: (s: string, p: number) => void): Promise<OcrLine[]> {
  const worker = await getWorker(lang, onProgress);
  await worker.setParameters({ tessedit_pageseg_mode: "11", preserve_interword_spaces: "1" }); // sparse text
  // Upscale small images to help the LSTM
  const scale = canvas.width < 2000 ? Math.min(3, 1400 / canvas.width) : 1;
  let input: HTMLCanvasElement = canvas;
  if (scale !== 1) { input = document.createElement("canvas"); input.width = Math.round(canvas.width * scale); input.height = Math.round(canvas.height * scale); const cx = input.getContext("2d")!; cx.imageSmoothingQuality = "high"; cx.drawImage(canvas, 0, 0, input.width, input.height); }
  const collect = (data: any, out: OcrLine[]) => {
  for (const block of data.blocks ?? []) for (const para of block.paragraphs ?? []) for (const line of para.lines ?? []) {
    let words = (line.words ?? []).filter((w: any) => w.confidence > 35 && /[A-Za-z0-9]/.test(w.text));
    if (!words.length) continue;
    if (words.length > 1) {
      const hs = words.map((w: any) => w.bbox.y1 - w.bbox.y0).sort((a: number, b: number) => a - b);
      const med = hs[Math.floor(hs.length / 2)];
      words = words.filter((w: any) => (w.bbox.y1 - w.bbox.y0) < med * 1.9 && (w.bbox.y1 - w.bbox.y0) > med * 0.35);
      if (!words.length) continue;
    }
    const text = words.map((w: any) => w.text).join(" ").trim();
    if (text.length < 2 && !/[A-Za-z0-9]/.test(text)) continue;
    const x0 = Math.min(...words.map((w: any) => w.bbox.x0)) / scale, x1 = Math.max(...words.map((w: any) => w.bbox.x1)) / scale;
    const y0 = Math.min(...words.map((w: any) => w.bbox.y0)) / scale, y1 = Math.max(...words.map((w: any) => w.bbox.y1)) / scale;
    out.push({ text, x0, y0, x1, y1, conf: words.reduce((a: number, w: any) => a + w.confidence, 0) / words.length, words: words.map((w: any) => ({ text: w.text, conf: w.confidence, x0: w.bbox.x0 / scale, y0: w.bbox.y0 / scale, x1: w.bbox.x1 / scale, y1: w.bbox.y1 / scale })) });
  }
  };
  const pass1: OcrLine[] = []; collect((await worker.recognize(input)).data, pass1);
  // Second pass on an inverted copy (light text on dark/colored areas is often missed otherwise)
  const inv = document.createElement("canvas"); inv.width = input.width; inv.height = input.height;
  const ictx = inv.getContext("2d")!; ictx.filter = "invert(1)"; ictx.drawImage(input, 0, 0);
  const pass2: OcrLine[] = []; try { collect((await worker.recognize(inv)).data, pass2); } catch {}
  if ((globalThis as any).__rcDebug) console.log("[analyze] ocr-inverted", JSON.stringify(pass2.map((l) => ({ t: l.text, box: [l.x0, l.y0, l.x1, l.y1].map(Math.round), c: Math.round(l.conf) }))));
  const iou = (a: OcrLine, b: OcrLine) => { const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)), iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)); const inter = ix * iy; const ua = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter; return ua ? inter / ua : 0; };
  const lines: OcrLine[] = [...pass1];
  for (const l of pass2) {
    const contains = (a: OcrLine, b: OcrLine) => { const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)), iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)); const small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0)); return small ? (ix * iy) / small > 0.7 : false; };
    const hit = lines.findIndex((m) => iou(l, m) > 0.3 || contains(l, m));
    if (hit < 0) lines.push(l);
    else { const m = lines[hit]; const wl = l.x1 - l.x0, wm = m.x1 - m.x0; const widerOrSame = wl >= wm * 0.85; if (widerOrSame && (l.text.length > m.text.length + 2 || (Math.abs(l.text.length - m.text.length) <= 2 && l.conf > m.conf + 8))) lines[hit] = l; } // take the better read, never a partial one
  }
  // drop noise: single character reads need very high confidence, 2-char ones need decent confidence
  const plausible = (l: OcrLine) => { const t = l.text.replace(/\s/g, ""); return t.length >= 3 ? l.conf > 45 : t.length === 2 ? l.conf > 80 && /[A-Za-z0-9]{2}|[0-9][%$€£]|[A-Z]\./.test(t) : l.conf > 92 && /[0-9A-Z]/.test(t) && l.conf > 0 && l.words[0].conf > 92; };
  const near = (l: OcrLine) => lines.some((o) => o !== l && o.text.replace(/\s/g, "").length >= 3 && Math.abs(((o.y0 + o.y1) - (l.y0 + l.y1)) / 2) < (l.y1 - l.y0) * 2.5);
  const minLen = bg.kind === "image" ? 2 : 1;
  const kept = lines.filter((l) => plausible(l) && l.text.replace(/\s/g, "").length >= minLen && (l.text.replace(/\s/g, "").length >= 2 || near(l)));
  // remove lines mostly contained in another (longer) line – duplicate partial reads
  const dedup = kept.filter((l) => !kept.some((o) => o !== l && o.text.length > l.text.length && (() => { const ix = Math.max(0, Math.min(l.x1, o.x1) - Math.max(l.x0, o.x0)), iy = Math.max(0, Math.min(l.y1, o.y1) - Math.max(l.y0, o.y0)); return (ix * iy) / ((l.x1 - l.x0) * (l.y1 - l.y0)) > 0.6; })()));
  return dedup.map((l) => refineLineBox(canvas, l, bg)).filter((l) => (l.x1 - l.x0) > 4 && (l.y1 - l.y0) > 4);
}

/** Tighten an OCR line box to its actual ink; cut off blobs separated by a wide horizontal gap (icons/badges OCR glued on). */
function refineLineBox(canvas: HTMLCanvasElement, l: OcrLine, bg: BgModel): OcrLine {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const x0 = Math.max(0, Math.floor(l.x0)), y0 = Math.max(0, Math.floor(l.y0));
  const w = Math.min(canvas.width, Math.ceil(l.x1)) - x0, h = Math.min(canvas.height, Math.ceil(l.y1)) - y0;
  if (w < 4 || h < 4) return l;
  const d = ctx.getImageData(x0, y0, w, h).data;
  const px = (i: number): RGB => [d[i], d[i + 1], d[i + 2]];
  const region: RGB[] = []; const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 3000)));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) region.push(px((y * w + x) * 4));
  const local = dominantColor(region, 16).color;
  const onPageBg = bg.kind !== "image" && dist(local, bg.colorAt(x0 + w / 2, y0 + h / 2)) < bg.tolerance;
  const isInk = (x: number, y: number) => { const c = px((y * w + x) * 4); return dist(c, local) > 40 && (!onPageBg || dist(c, bg.colorAt(x0 + x, y0 + y)) > bg.tolerance); };
  const cols = new Uint8Array(w), rows = new Uint8Array(h), rowOk = new Uint8Array(h);
  for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) if (isInk(x, y)) n++; rowOk[y] = n < w * 0.85 ? 1 : 0; }
  for (let y = 0; y < h; y++) { if (!rowOk[y]) continue; for (let x = 0; x < w; x++) { if (isInk(x, y)) { cols[x] = 1; rows[y] = 1; } } }
  // Per-column ink span. Glyph columns share a vertical band; glued icons/badges/shapes stick far outside it.
  const top = new Int16Array(w).fill(-1), bot = new Int16Array(w).fill(-1);
  for (let x = 0; x < w; x++) { if (!cols[x]) continue; for (let y = 0; y < h; y++) if (rowOk[y] && isInk(x, y)) { if (top[x] < 0) top[x] = y; bot[x] = y; } }
  const tops: number[] = [], bots: number[] = [];
  for (let x = 0; x < w; x++) if (top[x] >= 0) { tops.push(top[x]); bots.push(bot[x]); }
  if (!tops.length) return l;
  tops.sort((a, b) => a - b); bots.sort((a, b) => a - b);
  const bandT = tops[Math.floor(tops.length * 0.5)], bandB = bots[Math.floor(bots.length * 0.5)];
  const bandH = Math.max(4, bandB - bandT + 1);
  const ok = (x: number) => top[x] >= 0 && top[x] >= bandT - bandH * 0.45 && bot[x] <= bandB + bandH * 0.45;
  // Contiguous "ok" runs (allow gaps of blank columns); pick the run cluster covering the word centre
  const runs: [number, number][] = []; let rs = -1, last = -1;
  for (let x = 0; x < w; x++) {
    if (top[x] < 0) continue; // blank column
    if (ok(x)) { if (rs < 0) rs = x; last = x; } else { if (rs >= 0) runs.push([rs, last]); rs = -1; }
  }
  if (rs >= 0) runs.push([rs, last]);
  if (!runs.length) return l;
  const cx = (Math.min(...l.words.map((k) => k.x0)) + Math.max(...l.words.map((k) => k.x1))) / 2 - x0;
  let best = runs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  for (const r of runs) if (r[0] <= cx && cx <= r[1]) { best = r; break; }
  // merge neighbouring ok-runs separated only by blank space (word gaps), not by foreign blobs
  let nx0 = best[0], nx1 = best[1];
  for (const r of runs) {
    if (r === best) continue;
    const gapA = r[0] > nx1 ? r[0] : nx0, gapB = r[0] > nx1 ? nx1 : r[1];
    let foreign = false, blank = 0, maxBlank = 0;
    for (let x = gapB + 1; x < gapA; x++) { if (top[x] >= 0 && !ok(x)) { foreign = true; break; } if (top[x] < 0) { blank++; if (blank > maxBlank) maxBlank = blank; } else blank = 0; }
    if (!foreign && maxBlank <= bandH * 0.9) { nx0 = Math.min(nx0, r[0]); nx1 = Math.max(nx1, r[1]); }
  }
  let ry0 = h, ry1 = -1;
  for (let x = nx0; x <= nx1; x++) if (top[x] >= 0) { if (top[x] < ry0) ry0 = top[x]; if (bot[x] > ry1) ry1 = bot[x]; }
  void rows;
  const dropped = nx1 - nx0 + 1 < w - Math.max(4, h * 0.3);
  const text = dropped && /[.,:;]$/.test(l.text) ? l.text.replace(/[.,:;]$/, "") : l.text;
  return { ...l, text, x0: x0 + nx0, x1: x0 + nx1 + 1, y0: y0 + ry0, y1: y0 + ry1 + 1 };
}

/** Group OCR lines into blocks (paragraph-like) by vertical adjacency + similar height + horizontal overlap */
function groupLines(lines: OcrLine[]): OcrBlock[] {
  const sorted = [...lines].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const blocks: OcrBlock[] = [];
  for (const l of sorted) {
    const hgt = l.y1 - l.y0;
    let placed = false;
    for (const b of blocks) {
      const last = b.lines[b.lines.length - 1];
      const lh = last.y1 - last.y0;
      const gap = l.y0 - last.y1;
      const overlap = Math.min(l.x1, b.x1) - Math.max(l.x0, b.x0);
      const sameSize = Math.abs(lh - hgt) / Math.max(lh, hgt) < 0.2;
      const sameColor = !l.color || !last.color || dist(l.color, last.color) < 60;
      if (gap > -hgt * 0.3 && gap < Math.max(lh, hgt) * 0.6 && overlap > Math.min(l.x1 - l.x0, b.x1 - b.x0) * 0.3 && sameSize && sameColor) {
        b.lines.push(l); b.x0 = Math.min(b.x0, l.x0); b.x1 = Math.max(b.x1, l.x1); b.y1 = Math.max(b.y1, l.y1); placed = true; break;
      }
    }
    if (!placed) blocks.push({ lines: [l], x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1 });
  }
  return blocks;
}

/* ------------------------------------------------------------------ */
/* Text style estimation                                                */
/* ------------------------------------------------------------------ */
let measureCtx: CanvasRenderingContext2D | null = null;
function measure(text: string, family: string, weight: number, size: number) {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = `${weight} ${size}px "${family}"`;
  return measureCtx.measureText(text).width;
}

function estimateTextColor(img: Img, bg: BgModel, x0: number, y0: number, x1: number, y1: number): { color: RGB; inkRatio: number; strokeW: number } {
  const X0 = Math.max(0, Math.floor(x0)), X1 = Math.min(img.w - 1, Math.ceil(x1)), Y0 = Math.max(0, Math.floor(y0)), Y1 = Math.min(img.h - 1, Math.ceil(y1));
  const w = X1 - X0 + 1, h = Y1 - Y0 + 1;
  // Sample the region with a small margin: the surround tells us what "background" is here (page bg or a box behind the text)
  const m = Math.max(2, Math.round(h * 0.25));
  const ring: RGB[] = [];
  for (let x = Math.max(0, X0 - m); x <= Math.min(img.w - 1, X1 + m); x += 2) { for (const y of [Math.max(0, Y0 - m), Math.min(img.h - 1, Y1 + m)]) ring.push(img.px(x, y)); }
  for (let y = Math.max(0, Y0 - m); y <= Math.min(img.h - 1, Y1 + m); y += 2) { for (const x of [Math.max(0, X0 - m), Math.min(img.w - 1, X1 + m)]) ring.push(img.px(x, y)); }
  const local = ring.length ? dominantColor(ring, 16).color : bg.colorAt(X0, Y0);
  const tol = 40;
  const samples: RGB[] = [];
  let ink = 0, total = 0, runs = 0, runLen = 0;
  const stepY = Math.max(1, Math.floor(h / 40));
  for (let y = Y0; y <= Y1; y += stepY) {
    let cur = 0;
    for (let x = X0; x <= X1; x++) {
      const p = img.px(x, y);
      const isInk = dist(p, local) > tol;
      total++;
      if (isInk) { ink++; cur++; samples.push(p); } else if (cur) { runs++; runLen += cur; cur = 0; }
    }
    if (cur) { runs++; runLen += cur; }
  }
  if (!samples.length) return { color: lum(local) > 128 ? [17, 17, 17] : [255, 255, 255], inkRatio: 0, strokeW: 1 };
  // Anti-aliased edge pixels bias the average → take the dominant colour among the samples farthest from the surround
  const far = samples.map((p) => ({ p, d: dist(p, local) })).sort((a, b) => b.d - a.d);
  const core = far.slice(0, Math.max(20, Math.floor(far.length * 0.4))).map((f) => f.p);
  const color = dominantColor(core, 10).color;
  return { color, inkRatio: total ? ink / total : 0, strokeW: runs ? runLen / runs : 1 };
}

function pickFont(block: OcrBlock, capHeight: number, strokeW: number, inkRatio: number): { family: string; weight: number } {
  // heuristic: stroke width relative to x-height ⇒ weight; letterforms unknown ⇒ choose neutral sans/serif
  const rel = strokeW / Math.max(1, capHeight);
  const weight = rel > 0.19 ? 800 : rel > 0.14 ? 700 : rel > 0.10 ? 600 : rel > 0.075 ? 500 : 400;
  void inkRatio; void block;
  return { family: weight >= 700 ? "Poppins" : "Inter", weight };
}

/* ------------------------------------------------------------------ */
/* Inpainting (remove text pixels so they don't ghost under new layers) */
/* ------------------------------------------------------------------ */
function inpaintRegions(canvas: HTMLCanvasElement, bg: BgModel, rects: { x0: number; y0: number; x1: number; y1: number; color?: RGB }[], img: Img) {
  const ctx = canvas.getContext("2d")!;
  for (const r of rects) {
    const pad = Math.max(2, Math.round((r.y1 - r.y0) * 0.15));
    const x0 = Math.max(0, Math.floor(r.x0 - pad)), y0 = Math.max(0, Math.floor(r.y0 - pad));
    const x1 = Math.min(canvas.width, Math.ceil(r.x1 + pad)), y1 = Math.min(canvas.height, Math.ceil(r.y1 + pad));
    const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) continue;
    if (bg.kind !== "image") {
      // Fill with local dominant color (handles text sitting on a shape) or bg model
      const region: RGB[] = []; const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 2000)));
      for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) region.push(img.px(x, y));
      const dom = dominantColor(region, 16);
      if (dom.share > 0.45) {
        const domOnPage = dist(dom.color, bg.colorAt(x0 + w / 2, y0 + h / 2)) < bg.tolerance;
        // Replace only pixels that differ from the local dominant colour (the glyphs), so a button/shape under the text keeps its exact bounds
        const id = ctx.getImageData(x0, y0, w, h);
        for (let i = 0; i < id.data.length; i += 4) {
          const pxc: RGB = [id.data[i], id.data[i + 1], id.data[i + 2]];
          const d = dist(pxc, dom.color);
          const isPageBg = domOnPage && dist(pxc, bg.colorAt(x0 + ((i / 4) % w), y0 + Math.floor(i / 4 / w))) < bg.tolerance;
          const isGlyph = r.color ? dist(pxc, r.color) < 70 || (d > 18 && !isPageBg && dist(pxc, r.color) < dist(pxc, dom.color)) : d > 18 && !isPageBg;
          if (isGlyph && d > 18) { id.data[i] = dom.color[0]; id.data[i + 1] = dom.color[1]; id.data[i + 2] = dom.color[2]; id.data[i + 3] = 255; }
        }
        ctx.putImageData(id, x0, y0);
      }
      else { // per-pixel background model
        const id = ctx.getImageData(x0, y0, w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = bg.colorAt(x0 + x, y0 + y); const i = (y * w + x) * 4; id.data[i] = c[0]; id.data[i + 1] = c[1]; id.data[i + 2] = c[2]; id.data[i + 3] = 255; }
        ctx.putImageData(id, x0, y0);
      }
    } else {
      // photo background: smear surrounding pixels inward (cheap inpaint) using row/column blending
      const id = ctx.getImageData(x0, y0, w, h);
      const L = ctx.getImageData(Math.max(0, x0 - 1), y0, 1, h).data, R = ctx.getImageData(Math.min(canvas.width - 1, x1), y0, 1, h).data;
      const T = ctx.getImageData(x0, Math.max(0, y0 - 1), w, 1).data, B = ctx.getImageData(x0, Math.min(canvas.height - 1, y1), w, 1).data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4; const tx = x / (w - 1 || 1), ty = y / (h - 1 || 1);
        for (let k = 0; k < 3; k++) {
          const hz = L[y * 4 + k] * (1 - tx) + R[y * 4 + k] * tx, vt = T[x * 4 + k] * (1 - ty) + B[x * 4 + k] * ty;
          const wx = Math.min(tx, 1 - tx), wy = Math.min(ty, 1 - ty);
          id.data[i + k] = (hz * wy + vt * wx) / (wx + wy || 1);
        }
        id.data[i + 3] = 255;
      }
      ctx.putImageData(id, x0, y0);
      // soften
      ctx.save(); ctx.filter = "blur(1.5px)"; ctx.drawImage(canvas, x0, y0, w, h, x0, y0, w, h); ctx.restore();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Foreground component detection                                      */
/* ------------------------------------------------------------------ */
interface Comp { x0: number; y0: number; x1: number; y1: number; n: number; id: number }

function detectComponents(img: Img, bg: BgModel, exclude: { x0: number; y0: number; x1: number; y1: number }[]): { comps: Comp[]; labels: Int32Array; scale: number } {
  // work at reduced resolution for speed
  const scale = Math.max(1, Math.ceil(Math.max(img.w, img.h) / 600));
  const W = Math.floor(img.w / scale), H = Math.floor(img.h / scale);
  const fg = new Uint8Array(W * H);
  const tol = bg.tolerance;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x * scale, py = y * scale;
    if (img.alpha(px, py) < 20) continue;
    const p = img.px(px, py);
    let isFg = dist(p, bg.colorAt(px, py)) > tol;
    if (isFg) for (const r of exclude) if (px >= r.x0 - 2 && px <= r.x1 + 2 && py >= r.y0 - 2 && py <= r.y1 + 2) { isFg = false; break; }
    fg[y * W + x] = isFg ? 1 : 0;
  }
  // morphological close (dilate then erode) to merge anti-aliased edges / thin gaps
  const dil = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && fg[yy * W + xx]) { v = 1; break; } }
    dil[y * W + x] = v;
  }
  // connected components (4-neighbour flood fill, iterative)
  const labels = new Int32Array(W * H).fill(-1);
  const comps: Comp[] = [];
  const stack: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!dil[i] || labels[i] !== -1) continue;
    const id = comps.length;
    const c: Comp = { x0: W, y0: H, x1: 0, y1: 0, n: 0, id };
    stack.push(i); labels[i] = id;
    while (stack.length) {
      const j = stack.pop()!; const x = j % W, y = (j / W) | 0;
      c.n++; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      const nb = [j - 1, j + 1, j - W, j + W];
      if (x === 0) nb[0] = -1; if (x === W - 1) nb[1] = -1;
      for (const k of nb) if (k >= 0 && k < W * H && dil[k] && labels[k] === -1) { labels[k] = id; stack.push(k); }
    }
    comps.push(c);
  }
  return { comps, labels, scale };
}

type ShapeGuess = { kind: "rect" | "rounded" | "ellipse" | "image"; color?: RGB; radius?: number };

function classifyComponent(img: Img, c: Comp, scale: number, labels: Int32Array, W: number): ShapeGuess {
  const x0 = c.x0 * scale, y0 = c.y0 * scale, x1 = Math.min(img.w - 1, (c.x1 + 1) * scale - 1), y1 = Math.min(img.h - 1, (c.y1 + 1) * scale - 1);
  const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
  const fill = c.n / (bw * bh);
  // color uniformity of the component's own pixels
  const samples: RGB[] = [];
  const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 3000)));
  for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) {
    const lx = Math.floor(x / scale), ly = Math.floor(y / scale);
    if (labels[ly * W + lx] === c.id) samples.push(img.px(x, y));
  }
  if (!samples.length) return { kind: "image" };
  const dom = dominantColor(samples, 14);
  const uniform = dom.share > 0.75;
  if (!uniform) return { kind: "image" };
  const cornersEmpty = [[c.x0, c.y0], [c.x1, c.y0], [c.x0, c.y1], [c.x1, c.y1]].filter(([x, y]) => labels[y * W + x] !== c.id).length;
  if (fill > 0.93) {
    if (cornersEmpty >= 3) { let r = 0; for (let x = c.x0; x <= c.x1; x++) { if (labels[c.y0 * W + x] === c.id) { r = x - c.x0; break; } } if (r >= 1) return { kind: "rounded", color: dom.color, radius: r * scale * 1.4 }; }
    return { kind: "rect", color: dom.color };
  }
  if (fill > 0.72 && fill <= 0.93) {
    // ellipse fill ratio is π/4 ≈ 0.785; rounded rect between
    // check corners: if corner pixels are background -> rounded/ellipse
    const cornerEmpty = cornersEmpty;
    if (fill < 0.83 && cornerEmpty === 4 && Math.abs(bw - bh) / Math.max(bw, bh) < 0.6) return { kind: "ellipse", color: dom.color };
    // estimate radius: scan first row for where the shape starts
    let r = 0; for (let x = c.x0; x <= c.x1; x++) { if (labels[c.y0 * W + x] === c.id) { r = x - c.x0; break; } }
    return { kind: "rounded", color: dom.color, radius: r * scale * 1.4 };
  }
  return { kind: "image" };
}

function cutout(img: Img, bg: BgModel, x0: number, y0: number, x1: number, y1: number, transparentBg: boolean): { dataUrl: string; w: number; h: number } {
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img.canvas, x0, y0, w, h, 0, 0, w, h);
  if (transparentBg && bg.kind !== "image") {
    const id = ctx.getImageData(0, 0, w, h);
    const tol = bg.tolerance;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = dist([id.data[i], id.data[i + 1], id.data[i + 2]], bg.colorAt(x0 + x, y0 + y));
      if (d < tol * 0.6) id.data[i + 3] = 0; else if (d < tol) id.data[i + 3] = Math.round(255 * (d - tol * 0.6) / (tol * 0.4));
    }
    // only apply if the border is mostly background (object on flat bg), otherwise keep opaque (it's a photo)
    let borderBg = 0, borderN = 0;
    for (let x = 0; x < w; x++) { for (const y of [0, h - 1]) { borderN++; if (id.data[(y * w + x) * 4 + 3] < 128) borderBg++; } }
    for (let y = 0; y < h; y++) { for (const x of [0, w - 1]) { borderN++; if (id.data[(y * w + x) * 4 + 3] < 128) borderBg++; } }
    if (borderBg / borderN > 0.35) ctx.putImageData(id, 0, 0);
  }
  return { dataUrl: c.toDataURL("image/png"), w, h };
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */
export async function analyzeImage(source: HTMLImageElement, name: string, opts: AnalyzeOptions): Promise<{ project: Project; stats: AnalyzeStats }> {
  const t0 = performance.now();
  const prog = (s: string, p: number) => opts.onProgress?.(s, p);
  (globalThis as any).__rcDebug = !!opts.debug;
  const W = source.naturalWidth, H = source.naturalHeight;
  // Working canvas (cap at 2400 for memory; project keeps true size)
  const cap = 2400; const k = Math.min(1, cap / Math.max(W, H));
  const cw = Math.round(W * k), ch = Math.round(H * k);
  const canvas = document.createElement("canvas"); canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, cw, ch);
  const img = new Img(canvas);
  const S = 1 / k; // canvas → project coordinates

  prog("Analyzing background", 0.05);
  const bg = analyzeBackground(img);

  const project = newProject(name, W, H);
  const page = project.pages[0];
  page.background = { ...bg.background };
  const elements: DesignElement[] = [];
  const stats: AnalyzeStats = { texts: 0, images: 0, shapes: 0, bgType: bg.kind, ms: 0 };

  /* ---- Text ---- */
  let textRects: { x0: number; y0: number; x1: number; y1: number; color?: RGB }[] = [];
  const textEls: DesignElement[] = [];
  if (opts.ocr) {
    prog("Loading OCR engine", 0.1);
    let lines: OcrLine[] = [];
    try { lines = await runOcr(canvas, bg, opts.language ?? "eng", (s, p) => prog(s === "recognizing text" ? "Recognizing text" : s, 0.1 + p * 0.5)); }
    catch (e) { console.warn("OCR failed", e); }
    for (const l of lines) l.color = estimateTextColor(img, bg, l.x0, l.y0, l.x1, l.y1).color;
    const blocks = groupLines(lines);
    if (opts.debug) console.log("[analyze] ocr", JSON.stringify(lines.map((l) => ({ t: l.text, box: [l.x0, l.y0, l.x1, l.y1].map(Math.round), c: Math.round(l.conf) }))), "bg", bg.kind, bg.tolerance);
    for (const b of blocks) {
      const lineH = b.lines.reduce((a, l) => a + (l.y1 - l.y0), 0) / b.lines.length;
      const { color, strokeW } = estimateTextColor(img, bg, b.x0, b.y0, b.x1, b.y1);
      const font = pickFont(b, lineH, strokeW, 0);
      // fit font size: choose size so measured widest line == bbox width
      const widest = b.lines.reduce((a, l) => ((l.x1 - l.x0) > (a.x1 - a.x0) ? l : a), b.lines[0]);
      const targetW = (widest.x1 - widest.x0) * S;
      // Size from width (most reliable across fonts), sanity-bounded by bbox height
      const probe = 100;
      const mw = measure(widest.text, font.family, font.weight, probe);
      let size = mw > 0 ? probe * (targetW / mw) : lineH * S * 1.3;
      const hasDesc = /[gjpqy]/.test(widest.text), hasCap = /[A-Z0-9bdfhklt]/.test(widest.text);
      const byHeight = lineH * S * (hasDesc && hasCap ? 1.05 : hasCap ? 1.32 : 1.6);
      if (size > byHeight * 1.35) size = byHeight * 1.35; if (size < byHeight * 0.7) size = byHeight * 0.7;
      size = Math.round(size * 10) / 10;
      // line spacing
      let lineHeight = 1.2;
      if (b.lines.length > 1) { const pitch = (b.lines[b.lines.length - 1].y0 - b.lines[0].y0) / (b.lines.length - 1) * S; lineHeight = Math.max(0.8, Math.min(2.2, pitch / size)); }
      // alignment
      const lefts = b.lines.map((l) => l.x0), rights = b.lines.map((l) => l.x1), centers = b.lines.map((l) => (l.x0 + l.x1) / 2);
      const spread = (a: number[]) => Math.max(...a) - Math.min(...a);
      let align: "left" | "center" | "right" = "left";
      if (b.lines.length > 1) { const sl = spread(lefts), sr = spread(rights), sc = spread(centers); align = sc < sl && sc < sr ? "center" : sr < sl ? "right" : "left"; }
      else { const cx = (b.x0 + b.x1) / 2; if (Math.abs(cx - cw / 2) < cw * 0.03) align = "center"; }
      const text = b.lines.map((l) => l.text.replace(/(?<=[A-Z0-9%])[.,]$/, "")).join("\n");
      const boxW = (b.x1 - b.x0) * S; const boxH = size * lineHeight * b.lines.length;
      const capH = size * 0.72;
      const yTop = b.y0 * S - (size * lineHeight - capH) / 2 - (hasDesc || !hasCap ? 0 : 0);
      const xLeft = b.x0 * S;
      const el = newText(text, { fontFamily: font.family, fontWeight: font.weight, fontSize: size, lineHeight, align, uppercase: false, fill: solidFill(hex(color)), autoWidth: b.lines.length === 1, width: Math.max(boxW * 1.02, 10), height: boxH, x: xLeft - boxW * 0.01, y: yTop, name: text.slice(0, 24) });
      textEls.push(el); stats.texts++;
      textRects.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, color });
    }
  }

  /* ---- Inpaint text so it doesn't ghost behind editable layers ---- */
  prog("Separating layers", 0.65);
  if (textRects.length) inpaintRegions(canvas, bg, textRects, img);
  const clean = new Img(canvas);

  /* ---- Shapes & images ---- */
  if (opts.detectShapes && bg.kind !== "image") {
    const { comps, labels, scale } = detectComponents(clean, bg, []);
    const Wl = Math.floor(clean.w / scale);
    const minArea = Math.max(16, (Wl * Math.floor(clean.h / scale)) * 0.0006);
    const usable = comps.filter((c) => c.n >= minArea && (c.x1 - c.x0) >= 3 && (c.y1 - c.y0) >= 3).sort((a, b) => b.n - a.n).slice(0, 40);
    for (const c of usable) {
      const g = classifyComponent(clean, c, scale, labels, Wl);
      if (opts.debug) console.log("[analyze] comp", JSON.stringify({ box: [c.x0 * scale, c.y0 * scale, (c.x1 + 1) * scale, (c.y1 + 1) * scale], n: c.n, fill: +(c.n / ((c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1))).toFixed(2), kind: g.kind }));
      const x0 = c.x0 * scale, y0 = c.y0 * scale, x1 = Math.min(clean.w - 1, (c.x1 + 1) * scale - 1), y1 = Math.min(clean.h - 1, (c.y1 + 1) * scale - 1);
      const px = x0 * S, py = y0 * S, pw = (x1 - x0 + 1) * S, ph = (y1 - y0 + 1) * S;
      if (g.kind === "image") {
        const cut = cutout(clean, bg, x0, y0, x1, y1, true);
        const id = uid(); project.assets[id] = cut.dataUrl;
        const el = newImage(id, cut.w, cut.h, pw, ph); el.x = px; el.y = py; el.name = "Image";
        elements.push(el); stats.images++;
      } else {
        const el = newShape(g.kind === "ellipse" ? "ellipse" : g.kind === "rounded" ? "rounded" : "rect", { width: pw, height: ph, x: px, y: py, fill: solidFill(hex(g.color!)), radius: g.kind === "rounded" ? Math.round((g.radius ?? 0) * S) : 0, name: g.kind === "ellipse" ? "Ellipse" : "Rectangle" });
        elements.push(el); stats.shapes++;
      }
    }
  } else if (bg.kind === "image") {
    // Complex background: keep the inpainted picture as the page background image
    const id = uid(); project.assets[id] = canvas.toDataURL("image/jpeg", 0.92);
    page.background.type = "image"; page.background.assetId = id;
  }

  // Order: larger elements first (behind), text on top
  page.elements = [...elements, ...textEls];
  stats.ms = Math.round(performance.now() - t0);
  prog("Done", 1);
  return { project, stats };
}

/** Warm the OCR worker in the background (called when the import dialog opens) */
export function preloadOcr(lang = "eng") { getWorker(lang).catch(() => {}); }

export const FONT_FAMILIES = FONTS.map((f) => f.family);
