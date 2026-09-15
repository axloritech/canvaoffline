"use client";
import React, { useMemo, useRef, useState } from "react";
import * as Lucide from "lucide-react";
import { Search, Type, Plus, Upload, ImagePlus, Trash2, Copy, ChevronUp, ChevronDown, X, Check } from "lucide-react";
import { useEditor } from "@/store/editor";
import { FONTS } from "@/lib/fonts";
import { newText, newShape, newLine, newIcon, newImage, SHAPES, ICON_NAMES, GRADIENT_PRESETS, SOLID_PALETTE, solidFill, RED } from "@/lib/defaults";
import { shapePath, gradientCss } from "@/lib/render";
import { readFileAsDataURL, downscaleImage } from "@/lib/exporter";
import { ColorPanel, GradientEditor } from "./ColorPicker";
import { Slider, Seg, toast, Select } from "./ui";
import { TextureProps } from "./TextureProps";
import type { ShapeKind, TextElement } from "@/lib/types";

function centerPos(w: number, h: number) {
  const p = useEditor.getState().project!;
  return { x: Math.round((p.width - w) / 2), y: Math.round((p.height - h) / 2) };
}
function scaleFor() { const p = useEditor.getState().project!; return Math.min(p.width, p.height) / 1080; }

/* ---------------- TEXT ---------------- */
export function TextPanel() {
  const st = useEditor();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | "sans" | "serif" | "script" | "display" | "mono">("all");
  const sel = st.page()?.elements.find((e) => e.id === st.selection[0]);
  const curFont = sel?.type === "text" ? sel.fontFamily : null;
  const fonts = useMemo(() => FONTS.filter((f) => (cat === "all" || f.category === cat) && f.family.toLowerCase().includes(q.toLowerCase())), [q, cat]);

  const add = (preset: "heading" | "sub" | "body") => {
    const s = scaleFor();
    const opts: Partial<TextElement> = preset === "heading" ? { text: "Add a heading", fontSize: Math.round(72 * s), fontWeight: 700, fontFamily: "Poppins" }
      : preset === "sub" ? { text: "Add a subheading", fontSize: Math.round(40 * s), fontWeight: 600, fontFamily: "Poppins" }
      : { text: "Add a little bit of body text", fontSize: Math.round(24 * s), fontWeight: 400, fontFamily: "Inter" };
    const w = Math.min(useEditor.getState().project!.width * 0.8, (opts.fontSize ?? 24) * (opts.text!.length * 0.55));
    const h = (opts.fontSize ?? 24) * 1.2;
    st.addElement(newText(opts.text, { ...opts, width: w, height: h, ...centerPos(w, h) }));
  };
  const setFont = (family: string) => {
    if (sel?.type === "text") st.updateElement(sel.id, { fontFamily: family });
    else { const s = scaleFor(); const w = 500 * s, h = 60 * s; st.addElement(newText("Your text here", { fontFamily: family, fontSize: Math.round(48 * s), width: w, height: h, ...centerPos(w, h) })); }
  };
  return (
    <>
      <div className="panel-head">Text</div>
      <div className="panel-body">
        <button className="btn primary block lg" onClick={() => add("heading")}><Type size={16} /> Add a text box</button>
        <div style={{ height: 10 }} />
        <button className="text-preset" onClick={() => add("heading")}><span style={{ fontSize: 22, fontWeight: 700, fontFamily: "Poppins" }}>Add a heading</span></button>
        <button className="text-preset" onClick={() => add("sub")}><span style={{ fontSize: 16, fontWeight: 600, fontFamily: "Poppins" }}>Add a subheading</span></button>
        <button className="text-preset" onClick={() => add("body")}><span style={{ fontSize: 13, fontFamily: "Inter" }}>Add a little bit of body text</span></button>
        <div className="section-title">Fonts <span style={{ textTransform: "none", letterSpacing: 0 }}>{FONTS.length} offline</span></div>
        <div className="search"><Search size={15} color="var(--muted)" /><input placeholder="Search fonts…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="preset-cats" style={{ marginBottom: 10 }}>
          {(["all", "sans", "serif", "script", "display", "mono"] as const).map((c) => <button key={c} className={"chip" + (cat === c ? " active" : "")} style={{ height: 26, padding: "0 10px" }} onClick={() => setCat(c)}>{c[0].toUpperCase() + c.slice(1)}</button>)}
        </div>
        <div className="font-list">
          {fonts.map((f) => (
            <button key={f.family} className={"font-item" + (curFont === f.family ? " active" : "")} style={{ fontFamily: `"${f.family}"` }} onClick={() => setFont(f.family)}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.family}</span>
              {curFont === f.family ? <Check size={16} /> : <small>{f.category}</small>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------------- SHAPES & ELEMENTS ---------------- */
export function ShapesPanel() {
  const st = useEditor();
  const addShape = (k: ShapeKind) => { const s = scaleFor(); const size = Math.round(300 * s); st.addElement(newShape(k, { width: size, height: k === "ellipse" || k === "half-circle" ? size * 0.6 : size, radius: Math.round(40 * s), ...centerPos(size, size) })); };
  const addLine = (opts: Parameters<typeof newLine>[0]) => { const s = scaleFor(); const w = Math.round(400 * s); st.addElement(newLine({ width: w, height: 24, thickness: Math.round(6 * s), ...centerPos(w, 24), ...opts })); };
  return (
    <>
      <div className="panel-head">Shapes</div>
      <div className="panel-body">
        <div className="section-title">Basic shapes</div>
        <div className="grid-4">
          {SHAPES.map((s) => (
            <button key={s.kind} className="tile" title={s.label} onClick={() => addShape(s.kind)}>
              <svg viewBox="-2 -2 104 104"><path d={shapePath(s.kind, 100, 100, 20)} fill="currentColor" fillRule="evenodd" /></svg>
            </button>
          ))}
        </div>
        <div className="section-title">Lines & arrows</div>
        <div className="grid-3">
          {([
            { label: "Line", o: {} }, { label: "Arrow", o: { endHead: "arrow" } }, { label: "Double", o: { startHead: "arrow", endHead: "arrow" } },
            { label: "Dashed", o: { dash: "dashed" } }, { label: "Dotted", o: { dash: "dotted" } }, { label: "Dot ends", o: { startHead: "circle", endHead: "circle" } },
            { label: "Dash arrow", o: { dash: "dashed", endHead: "arrow" } }, { label: "Square", o: { startHead: "square", endHead: "square" } }, { label: "Thick", o: { thickness: 16 } },
          ] as const).map((l) => (
            <button key={l.label} className="tile" style={{ aspectRatio: "3/2" }} title={l.label} onClick={() => addLine(l.o as any)}>
              <svg viewBox="0 0 100 40" style={{ width: "80%", height: "80%" }}>
                <line x1={(l.o as any).startHead ? 14 : 4} y1="20" x2={(l.o as any).endHead ? 86 : 96} y2="20" stroke="currentColor" strokeWidth={(l.o as any).thickness ? 8 : 4} strokeDasharray={(l.o as any).dash === "dashed" ? "10 6" : (l.o as any).dash === "dotted" ? "0 8" : undefined} strokeLinecap={(l.o as any).dash === "dotted" ? "round" : "butt"} />
                {(l.o as any).endHead === "arrow" && <polygon points="98,20 84,12 84,28" fill="currentColor" />}
                {(l.o as any).startHead === "arrow" && <polygon points="2,20 16,12 16,28" fill="currentColor" />}
                {(l.o as any).endHead === "circle" && <circle cx="90" cy="20" r="6" fill="currentColor" />}
                {(l.o as any).startHead === "circle" && <circle cx="10" cy="20" r="6" fill="currentColor" />}
                {(l.o as any).endHead === "square" && <rect x="84" y="14" width="12" height="12" fill="currentColor" />}
                {(l.o as any).startHead === "square" && <rect x="4" y="14" width="12" height="12" fill="currentColor" />}
              </svg>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function ElementsPanel() {
  const st = useEditor();
  const [q, setQ] = useState("");
  const icons = useMemo(() => ICON_NAMES.filter((n) => n.toLowerCase().includes(q.toLowerCase())), [q]);
  const add = (name: string) => { const s = scaleFor(); const size = Math.round(200 * s); st.addElement(newIcon(name, { width: size, height: size, color: "#111111", ...centerPos(size, size) })); };
  const addShape = (k: ShapeKind) => { const s = scaleFor(); const size = Math.round(300 * s); st.addElement(newShape(k, { width: size, height: size, ...centerPos(size, size) })); };
  return (
    <>
      <div className="panel-head">Elements</div>
      <div className="panel-body">
        <div className="search"><Search size={15} color="var(--muted)" /><input placeholder="Search icons…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {!q && <>
          <div className="section-title">Quick shapes <button className="btn sm soft" onClick={() => st.setTool("shapes")}>See all</button></div>
          <div className="grid-6">
            {SHAPES.slice(0, 12).map((s) => <button key={s.kind} className="tile" title={s.label} onClick={() => addShape(s.kind)}><svg viewBox="-2 -2 104 104"><path d={shapePath(s.kind, 100, 100, 20)} fill="currentColor" fillRule="evenodd" /></svg></button>)}
          </div>
        </>}
        <div className="section-title">Icons <span style={{ textTransform: "none", letterSpacing: 0 }}>{icons.length}</span></div>
        <div className="grid-6">
          {icons.map((n) => { const I = (Lucide as any)[n]; if (!I) return null; return <button key={n} className="tile" title={n} onClick={() => add(n)}><I size={20} /></button>; })}
        </div>
        {!icons.length && <div className="empty">No icons match “{q}”</div>}
      </div>
    </>
  );
}

/* ---------------- IMAGES ---------------- */
export function ImagesPanel() {
  const st = useEditor();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const project = st.project!;
  const assets = Object.entries(project.assets);

  const importFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const raw = await readFileAsDataURL(f);
        const { dataUrl, w, h } = await downscaleImage(raw, 3000);
        const id = st.addAsset(dataUrl);
        placeAsset(id, w, h);
      } catch { toast("Could not read image", "err"); }
    }
  };
  const placeAsset = (id: string, w: number, h: number) => {
    const p = useEditor.getState().project!;
    const maxW = p.width * 0.6, maxH = p.height * 0.6;
    const r = Math.min(maxW / w, maxH / h, 1e9);
    const ew = Math.round(w * r), eh = Math.round(h * r);
    st.addElement(newImage(id, w, h, ew, eh) && { ...newImage(id, w, h, ew, eh), ...centerPos(ew, eh) });
  };
  const useAsBackground = (id: string) => { st.setBackground({ type: "image", assetId: id }); toast("Set as page background"); };
  const removeAsset = (id: string) => {
    const used = project.pages.some((pg) => pg.elements.some((e) => e.type === "image" && e.assetId === id) || pg.background.assetId === id);
    if (used && !confirm("This image is used in your design. Remove it anyway?")) return;
    st.commit();
    const p = structuredClone(project); delete p.assets[id];
    p.pages.forEach((pg) => { pg.elements = pg.elements.filter((e) => !(e.type === "image" && e.assetId === id)); if (pg.background.assetId === id) { pg.background.type = "solid"; delete pg.background.assetId; } });
    useEditor.setState({ project: p, selection: [] }); st.save();
  };
  return (
    <>
      <div className="panel-head">Images</div>
      <div className="panel-body">
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) importFiles(e.target.files); e.target.value = ""; }} />
        <button className="btn primary block lg" onClick={() => inputRef.current?.click()}><Upload size={16} /> Upload images</button>
        <div style={{ height: 10 }} />
        <div className={"upload-zone" + (over ? " over" : "")} onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); importFiles(e.dataTransfer.files); }}>
          <ImagePlus size={28} style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 600 }}>Drop images here</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>PNG, JPG, WebP, SVG, GIF · stored on this device</div>
        </div>
        {assets.length > 0 && <>
          <div className="section-title">Project images <span style={{ textTransform: "none", letterSpacing: 0 }}>{assets.length}</span></div>
          <div className="asset-grid">
            {assets.map(([id, src]) => (
              <div key={id} className="asset" title="Click to add · Right‑click for background" onClick={() => { const img = new Image(); img.onload = () => placeAsset(id, img.naturalWidth, img.naturalHeight); img.src = src; }} onContextMenu={(e) => { e.preventDefault(); useAsBackground(id); }}>
                <img src={src} alt="" />
                <button className="del" onClick={(e) => { e.stopPropagation(); removeAsset(id); }}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Tip: right‑click (or long‑press) an image to use it as the page background.</div>
        </>}
      </div>
    </>
  );
}

/* ---------------- BACKGROUND ---------------- */
export function BackgroundPanel() {
  const st = useEditor();
  const page = st.page()!; const bg = page.background;
  const inputRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<typeof bg>) => st.setBackground(patch);
  const [tab, setTab] = useState<"solid" | "gradient" | "image">(bg.type);
  return (
    <>
      <div className="panel-head">Background</div>
      <div className="panel-body">
        <Seg value={tab} options={[{ value: "solid", label: "Color" }, { value: "gradient", label: "Gradient" }, { value: "image", label: "Image" }]} onChange={(t) => { setTab(t); if (t !== "image" || bg.assetId) set({ type: t }); }} />
        <div style={{ height: 12 }} />
        {tab === "solid" && <>
          <div className="grid-6" style={{ marginBottom: 12 }}>
            {["#ffffff", "#f8fafc", "#f1f5f9", "#fef2f2", "#fff7ed", "#fefce8", "#f0fdf4", "#eff6ff", "#faf5ff", "#111318", "#1f2937", RED, ...SOLID_PALETTE.slice(6, 12)].map((c) => <button key={c} className={"swatch" + (bg.color === c && bg.type === "solid" ? " active" : "")} style={{ background: c }} onClick={() => set({ type: "solid", color: c })} />)}
          </div>
          <ColorPanel value={bg.color} onChange={(c) => set({ type: "solid", color: c })} alpha={false} />
          <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={() => set({ type: "solid", color: "transparent" })}>Transparent background</button>
        </>}
        {tab === "gradient" && <>
          <div className="grid-4" style={{ marginBottom: 12 }}>
            {GRADIENT_PRESETS.map((g, i) => <button key={i} className="swatch" style={{ background: gradientCss(g) }} onClick={() => set({ type: "gradient", gradient: structuredClone(g) })} />)}
          </div>
          <GradientEditor value={bg.gradient} onChange={(g) => set({ type: "gradient", gradient: g })} />
        </>}
        {tab === "image" && <>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const raw = await readFileAsDataURL(f); const { dataUrl } = await downscaleImage(raw, 3000); const id = st.addAsset(dataUrl); set({ type: "image", assetId: id }); e.target.value = ""; }} />
          <button className="btn primary block" onClick={() => inputRef.current?.click()}><Upload size={15} /> Upload background image</button>
          {bg.assetId && st.project!.assets[bg.assetId] && <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)" }}><img src={st.project!.assets[bg.assetId]} alt="" style={{ width: "100%", display: "block" }} /></div>}
          {Object.keys(st.project!.assets).length > 0 && <>
            <div className="section-title">From project images</div>
            <div className="asset-grid" style={{ marginTop: 0 }}>{Object.entries(st.project!.assets).map(([id, src]) => <div key={id} className="asset" onClick={() => set({ type: "image", assetId: id })}><img src={src} alt="" /></div>)}</div>
          </>}
          {bg.assetId && <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={() => set({ type: "solid" })}>Remove background image</button>}
        </>}
        <div className="section-title">Texture</div>
        <Slider label="Grain / noise" value={bg.noise} onChange={(v) => set({ noise: v })} format={(v) => `${v}%`} />
        <TextureProps value={bg.texture} onChange={(t) => set({ texture: t })} embedded />
        <div className="row" style={{ marginTop: 8 }}><span className="label w">Pattern</span><Select value={bg.pattern} options={[{ value: "none", label: "None" }, { value: "dots", label: "Dots" }, { value: "grid", label: "Grid" }, { value: "lines", label: "Lines" }, { value: "diagonal", label: "Diagonal" }]} onChange={(p) => set({ pattern: p })} /></div>
        {bg.pattern !== "none" && <>
          <Slider label="Pattern opacity" value={bg.patternOpacity * 100} onChange={(v) => set({ patternOpacity: v / 100 })} format={(v) => `${Math.round(v)}%`} />
          <div className="grid-6">{["#000000", "#ffffff", RED, "#3b82f6", "#22c55e", "#f59e0b"].map((c) => <button key={c} className={"swatch" + (bg.patternColor === c ? " active" : "")} style={{ background: c }} onClick={() => set({ patternColor: c })} />)}</div>
        </>}
      </div>
    </>
  );
}

/* ---------------- PAGES ---------------- */
export function PagesPanel() {
  const st = useEditor(); const p = st.project!;
  return (
    <>
      <div className="panel-head">Pages <button className="btn sm primary" onClick={st.addPage}><Plus size={14} /> Add</button></div>
      <div className="panel-body">
        {p.pages.map((pg, i) => (
          <div key={pg.id} className={"layer" + (i === st.pageIndex ? " active" : "")} style={{ height: 48 }} onClick={() => st.setPageIndex(i)}>
            <span className="thumb" style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
            <span className="name"><input defaultValue={pg.name} key={pg.id + pg.name} onClick={(e) => e.stopPropagation()} onBlur={(e) => st.renamePage(i, e.target.value || `Page ${i + 1}`)} style={{ border: 0, background: "transparent", outline: "none", width: "100%" }} /></span>
            <span className="acts" onClick={(e) => e.stopPropagation()}>
              <button className="ibtn sm" disabled={i === 0} onClick={() => st.movePage(i, i - 1)} title="Move up"><ChevronUp size={14} /></button>
              <button className="ibtn sm" disabled={i === p.pages.length - 1} onClick={() => st.movePage(i, i + 1)} title="Move down"><ChevronDown size={14} /></button>
              <button className="ibtn sm" onClick={() => st.duplicatePage(i)} title="Duplicate"><Copy size={14} /></button>
              <button className="ibtn sm danger" disabled={p.pages.length <= 1} onClick={() => { if (confirm(`Delete "${pg.name}"?`)) st.deletePage(i); }} title="Delete"><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
