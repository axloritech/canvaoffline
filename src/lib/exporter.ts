import type { DesignElement, Page, Project, TextElement, ImageElement, ShapeElement, LineElement, IconElement, Fill, Shadow, Glow } from "./types";
import { shapePath, maskSvgPath, hexToRgba, imageFilterCss, patternSvgDataUrl, noiseDataUrl, gradientCss } from "./render";

const imgCache = new Map<string, HTMLImageElement>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  const c = imgCache.get(src);
  if (c && c.complete) return Promise.resolve(c);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { imgCache.set(src, img); res(img); };
    img.onerror = rej;
    img.src = src;
  });
}

export async function iconSvgDataUrl(name: string, color: string, strokeWidth: number): Promise<string> {
  const lucide = await import("lucide-react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const React = await import("react");
  const Icon = (lucide as any)[name] ?? lucide.HelpCircle;
  const svg = renderToStaticMarkup(React.createElement(Icon, { color, strokeWidth, size: 256, xmlns: "http://www.w3.org/2000/svg" }));
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function makeGradient(ctx: CanvasRenderingContext2D, f: Fill, w: number, h: number) {
  if (f.type !== "gradient") return f.color;
  const g = f.gradient;
  if (g.type === "radial") {
    const gr = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
    g.stops.forEach((s) => gr.addColorStop(s.pos / 100, s.color));
    return gr;
  }
  // CSS angle: 0deg = to top, 90deg = to right
  const a = ((g.angle - 90) * Math.PI) / 180;
  const len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const cx = w / 2, cy = h / 2;
  const gr = ctx.createLinearGradient(cx - (Math.cos(a) * len) / 2, cy - (Math.sin(a) * len) / 2, cx + (Math.cos(a) * len) / 2, cy + (Math.sin(a) * len) / 2);
  g.stops.forEach((s) => gr.addColorStop(s.pos / 100, s.color));
  return gr;
}

function applyShadow(ctx: CanvasRenderingContext2D, shadow: Shadow, glow: Glow, scale: number) {
  if (shadow.enabled) {
    ctx.shadowColor = hexToRgba(shadow.color, shadow.opacity);
    ctx.shadowBlur = shadow.blur * scale; ctx.shadowOffsetX = shadow.x * scale; ctx.shadowOffsetY = shadow.y * scale;
  } else if (glow.enabled) {
    ctx.shadowColor = hexToRgba(glow.color, glow.opacity);
    ctx.shadowBlur = glow.blur * scale; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }
}
const clearShadow = (ctx: CanvasRenderingContext2D) => { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; };

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, letterSpacing: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      const w = ctx.measureText(test).width + letterSpacing * test.length;
      if (w > maxWidth && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

async function drawText(ctx: CanvasRenderingContext2D, el: TextElement, s: number) {
  const fontSize = el.fontSize * s;
  const family = `"${el.fontFamily}", sans-serif`;
  ctx.font = `${el.italic ? "italic " : ""}${el.fontWeight} ${fontSize}px ${family}`;
  try { await (document as any).fonts?.load(ctx.font); } catch {}
  ctx.textBaseline = "alphabetic";
  const ls = el.letterSpacing * s;
  if ("letterSpacing" in ctx) (ctx as any).letterSpacing = `${ls}px`;
  const text = el.uppercase ? el.text.toUpperCase() : el.text;
  const padding = 0;
  const lines = el.autoWidth ? text.split("\n") : wrapText(ctx, text, el.width * s - padding * 2, "letterSpacing" in ctx ? 0 : ls);
  const lh = fontSize * el.lineHeight;
  const W = el.width * s;
  const fill = makeGradient(ctx, el.fill, W, el.height * s);
  const ascent = fontSize * 0.8;
  lines.forEach((line, i) => {
    const lw = ctx.measureText(line).width;
    let x = padding;
    if (el.align === "center") x = (W - lw) / 2;
    else if (el.align === "right") x = W - lw - padding;
    const y = i * lh + (lh - fontSize) / 2 + ascent;
    applyShadow(ctx, el.shadow, el.glow, s);
    if (el.stroke.enabled && el.stroke.width > 0) {
      ctx.lineJoin = "round"; ctx.lineWidth = el.stroke.width * s * 2; ctx.strokeStyle = el.stroke.color;
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(line, x, y);
    clearShadow(ctx);
    if (el.underline) {
      ctx.fillStyle = typeof fill === "string" ? fill : el.fill.gradient.stops[0]?.color ?? "#000";
      ctx.fillRect(x, y + fontSize * 0.08, lw, Math.max(1, fontSize * 0.06));
    }
  });
  if ("letterSpacing" in ctx) (ctx as any).letterSpacing = "0px";
}

async function drawImage(ctx: CanvasRenderingContext2D, el: ImageElement, s: number, assets: Record<string, string>) {
  const src = assets[el.assetId]; if (!src) return;
  const img = await loadImage(src);
  const W = el.width * s, H = el.height * s;
  const maskPath = el.mask !== "none" ? maskSvgPath(el.mask, W, H) : null;
  const radius = el.radius * s;
  const clip = () => {
    const p = new Path2D(maskPath ?? shapePath(radius > 0 ? "rounded" : "rect", W, H, radius));
    ctx.clip(p);
    return p;
  };
  // shadow: draw silhouette first
  if (el.shadow.enabled || el.glow.enabled) {
    ctx.save();
    applyShadow(ctx, el.shadow, el.glow, s);
    ctx.fillStyle = "#000";
    ctx.fill(new Path2D(maskPath ?? shapePath(radius > 0 ? "rounded" : "rect", W, H, radius)));
    ctx.restore();
  }
  ctx.save();
  const path = clip();
  const filt = imageFilterCss({ ...el.filters, blur: el.filters.blur * s });
  if (filt !== "none") ctx.filter = filt;
  const sx = el.crop.x * img.naturalWidth, sy = el.crop.y * img.naturalHeight, sw = el.crop.w * img.naturalWidth, sh = el.crop.h * img.naturalHeight;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  ctx.filter = "none";
  if (el.frame.enabled) {
    ctx.lineWidth = el.frame.width * s * 2; ctx.strokeStyle = el.frame.color; ctx.stroke(path);
  }
  ctx.restore();
  if (el.stroke.enabled) {
    ctx.lineWidth = el.stroke.width * s; ctx.strokeStyle = el.stroke.color; ctx.stroke(path);
  }
}

function drawShape(ctx: CanvasRenderingContext2D, el: ShapeElement, s: number) {
  const W = el.width * s, H = el.height * s;
  const p = new Path2D(shapePath(el.shape, W, H, el.radius * s));
  applyShadow(ctx, el.shadow, el.glow, s);
  ctx.fillStyle = makeGradient(ctx, el.fill, W, H);
  ctx.fill(p, "evenodd");
  clearShadow(ctx);
  if (el.stroke.enabled && el.stroke.width > 0) { ctx.lineWidth = el.stroke.width * s; ctx.strokeStyle = el.stroke.color; ctx.lineJoin = "round"; ctx.stroke(p); }
}

function drawLine(ctx: CanvasRenderingContext2D, el: LineElement, s: number) {
  const W = el.width * s, H = el.height * s, t = el.thickness * s, y = H / 2;
  applyShadow(ctx, el.shadow, el.glow, s);
  ctx.strokeStyle = el.color; ctx.fillStyle = el.color; ctx.lineWidth = t; ctx.lineCap = el.dash === "dotted" ? "round" : "butt";
  ctx.setLineDash(el.dash === "dashed" ? [t * 3, t * 2] : el.dash === "dotted" ? [0, t * 2] : []);
  const headLen = t * 3;
  const x1 = el.startHead !== "none" ? headLen : 0, x2 = el.endHead !== "none" ? W - headLen : W;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.setLineDash([]);
  const head = (kind: string, x: number, dir: 1 | -1) => {
    ctx.beginPath();
    if (kind === "arrow") { ctx.moveTo(x, y); ctx.lineTo(x - dir * headLen, y - headLen * 0.6); ctx.lineTo(x - dir * headLen, y + headLen * 0.6); ctx.closePath(); ctx.fill(); }
    else if (kind === "circle") { ctx.arc(x - dir * headLen / 2, y, headLen / 2, 0, Math.PI * 2); ctx.fill(); }
    else if (kind === "square") { ctx.fillRect(dir === 1 ? x - headLen : x, y - headLen / 2, headLen, headLen); }
  };
  head(el.endHead, W, 1); head(el.startHead, 0, -1);
  clearShadow(ctx);
}

async function drawIcon(ctx: CanvasRenderingContext2D, el: IconElement, s: number) {
  const url = await iconSvgDataUrl(el.icon, el.color, el.strokeWidth);
  const img = await loadImage(url);
  applyShadow(ctx, el.shadow, el.glow, s);
  ctx.drawImage(img, 0, 0, el.width * s, el.height * s);
  clearShadow(ctx);
}

async function drawBackground(ctx: CanvasRenderingContext2D, page: Page, W: number, H: number, assets: Record<string, string>, transparent: boolean) {
  const bg = page.background;
  if (transparent && bg.type === "solid" && bg.color === "transparent") return;
  if (bg.type === "gradient") {
    ctx.fillStyle = makeGradient(ctx, { type: "gradient", color: "", gradient: bg.gradient }, W, H);
    ctx.fillRect(0, 0, W, H);
  } else if (bg.type === "image" && bg.assetId && assets[bg.assetId]) {
    ctx.fillStyle = bg.color; ctx.fillRect(0, 0, W, H);
    const img = await loadImage(assets[bg.assetId]);
    const r = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * r, h = img.naturalHeight * r;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  } else {
    ctx.fillStyle = bg.color; ctx.fillRect(0, 0, W, H);
  }
  if (bg.pattern !== "none") {
    const url = patternSvgDataUrl(bg.pattern, bg.patternColor, bg.patternOpacity);
    if (url) {
      const img = await loadImage(url.slice(5, -2));
      const pat = ctx.createPattern(img, "repeat");
      if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); }
    }
  }
  if (bg.noise > 0) {
    const img = await loadImage(noiseDataUrl());
    const pat = ctx.createPattern(img, "repeat");
    if (pat) {
      ctx.save(); ctx.globalAlpha = bg.noise / 100; ctx.globalCompositeOperation = "overlay"; ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }
}

export async function renderPage(project: Project, page: Page, scale = 1, transparent = false): Promise<HTMLCanvasElement> {
  const W = Math.round(project.width * scale), H = Math.round(project.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  if (!transparent) await drawBackground(ctx, page, W, H, project.assets, false);
  else if (page.background.type !== "solid" || page.background.color !== "transparent") await drawBackground(ctx, page, W, H, project.assets, true);

  for (const el of page.elements) {
    if (el.hidden || el.type === "group") continue;
    const groupHidden = el.groupId && page.elements.find((g) => g.id === el.groupId)?.hidden;
    if (groupHidden) continue;
    const group = el.groupId ? (page.elements.find((g) => g.id === el.groupId) as DesignElement | undefined) : undefined;
    ctx.save();
    ctx.globalAlpha = el.opacity * (group?.opacity ?? 1);
    const cx = (el.x + el.width / 2) * scale, cy = (el.y + el.height / 2) * scale;
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
    ctx.translate(-(el.width * scale) / 2, -(el.height * scale) / 2);
    try {
      if (el.type === "text") await drawText(ctx, el, scale);
      else if (el.type === "image") await drawImage(ctx, el, scale, project.assets);
      else if (el.type === "shape") drawShape(ctx, el, scale);
      else if (el.type === "line") drawLine(ctx, el, scale);
      else if (el.type === "icon") await drawIcon(ctx, el, scale);
    } catch (e) { console.warn("render fail", el, e); }
    ctx.restore();
  }
  return canvas;
}

export async function exportPage(project: Project, page: Page, opts: { format: "png" | "jpg" | "webp"; scale: number; quality: number; transparent: boolean }): Promise<Blob> {
  const canvas = await renderPage(project, page, opts.scale, opts.transparent && opts.format !== "jpg");
  const mime = opts.format === "png" ? "image/png" : opts.format === "jpg" ? "image/jpeg" : "image/webp";
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), mime, opts.quality));
}

export async function thumbnail(project: Project, page: Page, maxW = 320): Promise<string> {
  const scale = Math.min(1, maxW / project.width, maxW / project.height);
  const c = await renderPage(project, page, scale);
  return c.toDataURL("image/jpeg", 0.7);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
}

export async function downscaleImage(dataUrl: string, maxDim = 2400): Promise<{ dataUrl: string; w: number; h: number }> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth, h = img.naturalHeight;
  if (Math.max(w, h) <= maxDim) return { dataUrl, w, h };
  const r = maxDim / Math.max(w, h);
  const c = document.createElement("canvas"); c.width = Math.round(w * r); c.height = Math.round(h * r);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const isPng = dataUrl.startsWith("data:image/png");
  return { dataUrl: c.toDataURL(isPng ? "image/png" : "image/jpeg", 0.92), w: c.width, h: c.height };
}

export { gradientCss };
