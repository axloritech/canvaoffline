"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Download, AlertTriangle, FileJson, Check } from "lucide-react";
import { useEditor } from "@/store/editor";
import { PRESETS } from "@/lib/defaults";
import { exportPage, downloadBlob, renderPage } from "@/lib/exporter";
import { Modal, Seg, Slider, NumField, toast } from "./ui";
import type { Project } from "@/lib/types";

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "design";

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const st = useEditor(); const p = st.project!;
  const [format, setFormat] = useState<"png" | "jpg" | "webp">("png");
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState(92);
  const [transparent, setTransparent] = useState(false);
  const [pages, setPages] = useState<"current" | "all">("current");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const page = p.pages[st.pageIndex];

  useEffect(() => {
    let alive = true;
    renderPage(p, page, Math.min(1, 480 / p.width)).then((c) => alive && setPreview(c.toDataURL())).catch(() => {});
    return () => { alive = false; };
  }, [p, page]);

  const outW = Math.round(p.width * scale), outH = Math.round(p.height * scale);
  const tooBig = outW * outH > 64_000_000;

  const run = async () => {
    setBusy(true);
    try {
      const targets = pages === "all" ? p.pages : [page];
      for (let i = 0; i < targets.length; i++) {
        const blob = await exportPage(p, targets[i], { format, scale, quality: quality / 100, transparent });
        const name = `${slug(p.name)}${targets.length > 1 ? `-page-${i + 1}` : ""}.${format}`;
        downloadBlob(blob, name);
        if (targets.length > 1) await new Promise((r) => setTimeout(r, 300));
      }
      toast(`Exported ${targets.length} ${targets.length > 1 ? "files" : "file"}`);
      onClose();
    } catch (e) { console.error(e); toast("Export failed — try a smaller size", "err"); }
    setBusy(false);
  };

  return (
    <Modal title="Export design" onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || tooBig} onClick={run}><Download size={15} /> {busy ? "Exporting…" : `Download ${format.toUpperCase()}`}</button></>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div className="section-title">Preview</div>
          <div style={{ background: "repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0 / 16px 16px", border: "1px solid var(--line)", borderRadius: 10, aspectRatio: "1", display: "grid", placeItems: "center", overflow: "hidden" }}>
            {preview ? <img src={preview} alt="" style={{ maxWidth: "92%", maxHeight: "92%", boxShadow: "var(--shadow-md)" }} /> : <span style={{ color: "var(--muted)" }}>Rendering…</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>{outW} × {outH} px</div>
        </div>
        <div>
          <div className="section-title">Format</div>
          <Seg value={format} options={[{ value: "png", label: "PNG" }, { value: "jpg", label: "JPG" }, { value: "webp", label: "WebP" }]} onChange={setFormat} />
          <div className="section-title">Size / resolution</div>
          <Seg value={String(scale)} options={[{ value: "0.5", label: "0.5×" }, { value: "1", label: "1×" }, { value: "2", label: "2×" }, { value: "3", label: "3×" }]} onChange={(v) => setScale(parseFloat(v))} />
          <div style={{ height: 8 }} />
          <div className="row two"><NumField label="W" value={outW} min={16} onChange={(v) => setScale(v / p.width)} /><NumField label="H" value={outH} min={16} onChange={(v) => setScale(v / p.height)} /></div>
          {format !== "png" && <><div className="section-title">Quality</div><Slider label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={(v) => `${v}%`} /></>}
          {format !== "jpg" && <div className="row" style={{ marginTop: 8 }}><label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Transparent background</label></div>}
          {p.pages.length > 1 && <><div className="section-title">Pages</div><Seg value={pages} options={[{ value: "current", label: "Current page" }, { value: "all", label: `All (${p.pages.length})` }]} onChange={setPages} /></>}
          {tooBig && <div className="warn-box" style={{ marginTop: 12 }}><AlertTriangle size={16} />Output is too large for the browser to render. Reduce the size.</div>}
        </div>
      </div>
    </Modal>
  );
}

export function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, w: number, h: number) => void }) {
  const [cat, setCat] = useState("Social Media");
  const [w, setW] = useState(1080); const [h, setH] = useState(1080);
  const [name, setName] = useState("Untitled design");
  const [sel, setSel] = useState<string | null>("Instagram Post");
  const cats = useMemo(() => ["Custom", ...Array.from(new Set(PRESETS.map((p) => p.category)))], []);
  const list = PRESETS.filter((p) => p.category === cat);
  return (
    <Modal title="Create a new design" wide onClose={onClose} foot={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onCreate(name.trim() || "Untitled design", w, h)}>Create design</button></>}>
      <div className="row" style={{ marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: "2 1 200px", height: 38 }}><span className="pre">Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field" style={{ flex: "1 1 100px", height: 38 }}><span className="pre">W</span><input type="number" value={w} onChange={(e) => { setW(+e.target.value); setSel(null); }} /><span className="unit">px</span></div>
        <div className="field" style={{ flex: "1 1 100px", height: 38 }}><span className="pre">H</span><input type="number" value={h} onChange={(e) => { setH(+e.target.value); setSel(null); }} /><span className="unit">px</span></div>
      </div>
      <div className="preset-cats">{cats.map((c) => <button key={c} className={"chip" + (cat === c ? " active" : "")} onClick={() => setCat(c)}>{c}</button>)}</div>
      {cat === "Custom" ? (
        <div className="preset-grid">
          {[[800, 800], [1200, 800], [800, 1200], [1920, 1080], [1080, 1920], [2000, 2000], [600, 400], [1600, 400]].map(([pw, ph]) => (
            <button key={`${pw}x${ph}`} className={"preset" + (w === pw && h === ph ? " active" : "")} onClick={() => { setW(pw); setH(ph); setSel(null); }}>
              <div className="box"><i style={{ width: 48 * Math.min(1, pw / ph), height: 48 * Math.min(1, ph / pw) }} /></div><b>{pw} × {ph}</b><small>Custom size</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="preset-grid">
          {list.map((p) => (
            <button key={p.name} className={"preset" + (sel === p.name ? " active" : "")} onClick={() => { setW(p.width); setH(p.height); setSel(p.name); if (name === "Untitled design" || PRESETS.some((x) => x.name === name)) setName(p.name); }}>
              <div className="box"><i style={{ width: 48 * Math.min(1, p.width / p.height), height: 48 * Math.min(1, p.height / p.width) }} /></div><b>{p.name}</b><small>{p.width} × {p.height} px</small>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function StorageWarning({ onClose }: { onClose: () => void }) {
  return (
    <Modal title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={18} color="#c2410c" /> Your work is stored on this device only</span>} onClose={onClose} foot={<button className="btn primary" onClick={onClose}><Check size={15} /> I understand</button>}>
      <p style={{ marginTop: 0, lineHeight: 1.6 }}>RedCanvas Studio is <b>offline‑first</b> and has no cloud account. Every project is saved in this browser’s local database (IndexedDB) on this device.</p>
      <div className="warn-box" style={{ marginBottom: 14 }}>
        <AlertTriangle size={16} />
        <div><b>Projects can be permanently lost</b> if you clear browsing data / site data, uninstall the app, use private/incognito mode, or if the browser evicts storage when the device is low on space.</div>
      </div>
      <p style={{ lineHeight: 1.6, margin: 0 }}>To keep a safe copy, use <b>Menu → Export project file (.redcanvas)</b> regularly. You can import that file on any device to restore or transfer your project.</p>
    </Modal>
  );
}

export function exportProjectFile(p: Project) {
  const blob = new Blob([JSON.stringify(p)], { type: "application/json" });
  downloadBlob(blob, `${slug(p.name)}.redcanvas`);
}

export async function importProjectFile(file: File): Promise<Project> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.pages) || typeof data.width !== "number") throw new Error("Not a valid RedCanvas project file");
  const { uid } = await import("@/lib/defaults");
  return { ...data, id: uid(), assets: data.assets ?? {}, guides: data.guides ?? [], updatedAt: Date.now(), createdAt: data.createdAt ?? Date.now(), version: 1 };
}

export { FileJson };
