"use client";
import React, { useEffect, useRef, useState } from "react";
import { Lock, Upload, Wand2, FileJson, Image as ImageIcon, Type, Shapes, Layers, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Modal, Switch, toast } from "./ui";
import { analyzeImage, preloadOcr, type AnalyzeStats } from "@/lib/analyze";
import { importProjectFile } from "./Dialogs";
import { readFileAsDataURL } from "@/lib/exporter";
import { renderPage } from "@/lib/exporter";
import type { Project } from "@/lib/types";

// Private beta gate. The feature is currently limited to the developer; the phrase below is checked client-side (offline).
const GATE_HASH = "8c84edad7223ce686bf08a75e9fc8dbab6821b7f2f291afb5a118cac64c96e15";
async function sha256(t: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }

export function ImportDialog(props: { onClose: () => void; onImported: (p: Project) => void }) {
  const { onClose } = props;
  const [unlocked, setUnlocked] = useState<boolean>(() => typeof sessionStorage !== "undefined" && sessionStorage.getItem("rc-import-unlocked") === "1");
  const [pin, setPin] = useState(""); const [pinErr, setPinErr] = useState(false); const [checking, setChecking] = useState(false);
  const tryUnlock = async () => {
    setChecking(true);
    const ok = (await sha256(pin.trim())) === GATE_HASH;
    setChecking(false);
    if (ok) { sessionStorage.setItem("rc-import-unlocked", "1"); setUnlocked(true); } else { setPinErr(true); setTimeout(() => setPinErr(false), 600); }
  };
  if (!unlocked) {
    return (
      <Modal title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><Wand2 size={18} color="var(--red)" /> Import & Edit</span>} onClose={onClose}
        foot={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!pin || checking} onClick={tryUnlock}><Lock size={15} /> Unlock</button></>}>
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--red-50)", color: "var(--red)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}><Lock size={26} /></div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Private beta</div>
          <div style={{ color: "var(--muted)", fontSize: 13, margin: "6px auto 16px", maxWidth: 340 }}>Import & Edit converts PNG/JPG designs into editable layers. Access is currently limited — enter the access password to continue.</div>
          <form onSubmit={(e) => { e.preventDefault(); tryUnlock(); }} style={{ maxWidth: 320, margin: "0 auto" }}>
            <input className={"input" + (pinErr ? " shake" : "")} type="password" autoFocus placeholder="Access password" value={pin} onChange={(e) => setPin(e.target.value)} style={{ width: "100%", textAlign: "center", fontSize: 15, letterSpacing: 2, borderColor: pinErr ? "var(--red)" : undefined }} />
            {pinErr && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 6 }}>Incorrect password</div>}
          </form>
          <div style={{ marginTop: 22, fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--line-2)", paddingTop: 12 }}>DM <b>axloritech</b> for password</div>
        </div>
      </Modal>
    );
  }
  return <ImportDialogInner {...props} />;
}

function ImportDialogInner({ onClose, onImported }: { onClose: () => void; onImported: (p: Project) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [ocr, setOcr] = useState(true);
  const [shapes, setShapes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(""); const [pct, setPct] = useState(0);
  const [result, setResult] = useState<{ project: Project; stats: AnalyzeStats; preview: string } | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { preloadOcr(); }, []);

  const pick = async (f: File) => {
    setResult(null); setFile(f);
    if (f.name.endsWith(".redcanvas") || f.type === "application/json") { setSrc(null); return; }
    if (!f.type.startsWith("image/")) { toast("Please choose a PNG/JPG image or a .redcanvas file", "err"); return; }
    setSrc(await readFileAsDataURL(f));
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      if (!src) { // project file → 100% accurate
        const p = await importProjectFile(file);
        onImported(p); toast(`Imported "${p.name}" with ${p.pages.reduce((a, pg) => a + pg.elements.length, 0)} editable layers`);
        return;
      }
      const img = new Image(); img.src = src; await img.decode();
      const name = file.name.replace(/\.[^.]+$/, "");
      const { project, stats } = await analyzeImage(img, name, { ocr, detectShapes: shapes, debug: typeof location !== "undefined" && location.search.includes("debug"), onProgress: (s, p) => { setStage(s); setPct(p); } });
      setStage("Rendering preview"); 
      const c = await renderPage(project, project.pages[0], Math.min(1, 520 / project.width));
      setResult({ project, stats, preview: c.toDataURL("image/jpeg", 0.85) });
    } catch (e: any) { console.error(e); toast(e?.message || "Import failed", "err"); }
    finally { setBusy(false); }
  };

  const layers = result ? result.project.pages[0].elements : [];
  return (
    <Modal title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><Wand2 size={18} color="var(--red)" /> Import & Edit</span>} onClose={onClose} wide
      foot={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        {!result && <button className="btn primary" disabled={!file || busy} onClick={run}>{busy ? <><Loader2 size={15} className="spin" /> {stage || "Working…"}</> : src ? <><Wand2 size={15} /> Analyze & convert to layers</> : <><FileJson size={15} /> Open project</>}</button>}
        {result && <button className="btn primary" onClick={() => { onImported(result.project); }}><Check size={15} /> Open in editor</button>}
      </>}>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,.redcanvas,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
      {!file && (
        <div className={"upload-zone" + (over ? " over" : "")} style={{ padding: "48px 20px" }} onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) pick(f); }}>
          <Upload size={34} style={{ marginBottom: 8 }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>Drop a PNG / JPG design or a .redcanvas project</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Flat images are analyzed on your device — text, images, shapes and background become separate editable layers.<br />Project files open with 100% accurate layers.</div>
        </div>
      )}
      {file && !result && (
        <div style={{ display: "grid", gridTemplateColumns: src ? "1fr 300px" : "1fr", gap: 20 }}>
          <div style={{ background: "repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0 / 16px 16px", border: "1px solid var(--line)", borderRadius: 12, minHeight: 200, display: "grid", placeItems: "center", overflow: "hidden", position: "relative" }}>
            {src ? <img src={src} alt="" style={{ maxWidth: "100%", maxHeight: 420, display: "block" }} /> : <div style={{ textAlign: "center", padding: 30 }}><FileJson size={36} color="var(--red)" /><div style={{ fontWeight: 700, marginTop: 8 }}>{file.name}</div><div style={{ color: "var(--muted)", fontSize: 12 }}>RedCanvas project · layers restore exactly</div></div>}
            {busy && <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.85)", display: "grid", placeItems: "center" }}>
              <div style={{ width: 260, textAlign: "center" }}>
                <Loader2 size={28} className="spin" color="var(--red)" />
                <div style={{ fontWeight: 700, marginTop: 8, textTransform: "capitalize" }}>{stage || "Starting"}</div>
                <div style={{ height: 6, background: "var(--line)", borderRadius: 6, marginTop: 10, overflow: "hidden" }}><div style={{ width: `${Math.round(pct * 100)}%`, height: "100%", background: "var(--red)", transition: "width .3s" }} /></div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 6 }}>Runs locally · nothing is uploaded</div>
              </div>
            </div>}
          </div>
          {src && (
            <div>
              <div className="section-title">Detection options</div>
              <div className="row" style={{ justifyContent: "space-between" }}><span><b style={{ display: "flex", alignItems: "center", gap: 6 }}><Type size={14} /> Detect text (OCR)</b><span style={{ fontSize: 11, color: "var(--muted)" }}>Recognizes text, estimates font size, weight, color & alignment</span></span><Switch on={ocr} onChange={setOcr} /></div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}><span><b style={{ display: "flex", alignItems: "center", gap: 6 }}><Shapes size={14} /> Detect shapes & images</b><span style={{ fontSize: 11, color: "var(--muted)" }}>Separates rectangles, rounded boxes, circles and photos from the background</span></span><Switch on={shapes} onChange={setShapes} /></div>
              <div className="warn-box" style={{ marginTop: 16 }}><AlertTriangle size={15} /><div>Analysis of flat images is a best‑effort reconstruction. Text becomes editable but the exact original font can't be identified — the closest bundled font and size are used, and you can change them afterwards.</div></div>
              <button className="btn ghost sm block" style={{ marginTop: 12 }} onClick={() => { setFile(null); setSrc(null); }}>Choose a different file</button>
            </div>
          )}
        </div>
      )}
      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
          <div>
            <div className="section-title">Reconstructed preview</div>
            <div style={{ background: "repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0 / 16px 16px", border: "1px solid var(--line)", borderRadius: 12, display: "grid", placeItems: "center", overflow: "hidden" }}>
              <img src={result.preview} alt="" style={{ maxWidth: "100%", maxHeight: 420, display: "block" }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <span className="pill"><Type size={13} /> {result.stats.texts} text</span>
              <span className="pill"><ImageIcon size={13} /> {result.stats.images} images</span>
              <span className="pill"><Shapes size={13} /> {result.stats.shapes} shapes</span>
              <span className="pill gray">background: {result.stats.bgType}</span>
              <span className="pill gray">{(result.stats.ms / 1000).toFixed(1)}s</span>
            </div>
          </div>
          <div>
            <div className="section-title"><span style={{ display: "flex", alignItems: "center", gap: 6 }}><Layers size={13} /> Layers ({layers.length})</span></div>
            <div style={{ maxHeight: 380, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10, padding: 4 }}>
              {[...layers].reverse().map((l) => (
                <div key={l.id} className="layer" style={{ height: 34 }}>
                  <span className="thumb" style={{ width: 22, height: 22 }}>{l.type === "text" ? <Type size={12} /> : l.type === "image" ? <ImageIcon size={12} /> : <Shapes size={12} />}</span>
                  <span className="name" style={{ fontSize: 12 }}>{l.type === "text" ? l.text.split("\n")[0] : l.name}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>{Math.round(l.width)}×{Math.round(l.height)}</span>
                </div>
              ))}
              {!layers.length && <div className="empty" style={{ padding: 20 }}>No separate layers were detected — the image was kept as the background.</div>}
            </div>
            <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={() => setResult(null)}>Adjust options & re‑run</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
