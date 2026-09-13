"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { WifiOff, Undo2, Redo2, Minus, Plus, Maximize2, Minimize2, Grid3X3, Ruler, Magnet, Download, MoreHorizontal, ChevronLeft, Type, Shapes, Image as ImageIcon, Paintbrush, Layers, LayoutGrid, Files, Sparkles, Check, Cloud, AlertTriangle, FileJson, Upload, Save, Copy, Trash2, X, PanelRightClose, PanelRightOpen, Home as HomeIcon, Keyboard, SlidersHorizontal, PlusSquare, Info } from "lucide-react";
import { useEditor, type Tool } from "@/store/editor";
import { getSetting, setSetting, saveProject } from "@/lib/db";
import { thumbnail } from "@/lib/exporter";
import { newText, newShape } from "@/lib/defaults";
import type { Project } from "@/lib/types";
import Canvas from "./Canvas";
import Home from "./Home";
import { TextPanel, ShapesPanel, ElementsPanel, ImagesPanel, BackgroundPanel, PagesPanel } from "./Panels";
import { PropertiesPanel, LayersPanel } from "./Properties";
import { ExportDialog, StorageWarning, exportProjectFile, importProjectFile, NewProjectDialog } from "./Dialogs";
import { Toasts, toast, useIsMobile, Modal } from "./ui";
import { renderPage } from "@/lib/exporter";

const TOOLS: { id: Tool; label: string; icon: React.ElementType }[] = [
  { id: "elements", label: "Elements", icon: LayoutGrid },
  { id: "text", label: "Text", icon: Type },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "shapes", label: "Shapes", icon: Shapes },
  { id: "background", label: "Background", icon: Paintbrush },
  { id: "pages", label: "Pages", icon: Files },
  { id: "layers", label: "Layers", icon: Layers },
];

export default function App() {
  const st = useEditor();
  const [route, setRoute] = useState<"home" | "editor">("home");
  const [showExport, setShowExport] = useState(false);
  const [showWarn, setShowWarn] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [mobileSheet, setMobileSheet] = useState<"tool" | "props" | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [installEvt, setInstallEvt] = useState<any>(null);
  useEffect(() => { const bip = (e: any) => { e.preventDefault(); setInstallEvt(e); }; window.addEventListener("beforeinstallprompt", bip); return () => window.removeEventListener("beforeinstallprompt", bip); }, []);
  const isMobile = useIsMobile();
  const [online, setOnline] = useState(true);
  useEffect(() => { setOnline(navigator.onLine); const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getSetting<boolean>("warnSeen").then((v) => { if (!v) setShowWarn(true); }); getSetting<boolean>("noteDismissed").then((v) => setShowNote(!v)); }, []);
  useEffect(() => { (window as any).__startCrop = (id: string) => { st.select([id]); setCropId(id); }; }, [st]);

  const openProject = (p: Project) => { st.setProject(p); setRoute("editor"); st.setTool("elements"); };
  const createProject = (name: string, w: number, h: number) => { const p = st.createProject(name, w, h); openProject(p); };
  const goHome = async () => { await saveWithThumb(); st.setProject(null); setRoute("home"); };

  const saveWithThumb = useCallback(async () => {
    const s = useEditor.getState(); if (!s.project) return;
    try { const t = await thumbnail(s.project, s.project.pages[0], 360); await s.save(t); } catch { await s.save(); }
  }, []);
  // thumbnail refresh every 20s while dirty
  useEffect(() => { const t = setInterval(() => { if (useEditor.getState().dirty) saveWithThumb(); }, 20000); return () => clearInterval(t); }, [saveWithThumb]);
  useEffect(() => { const h = () => { const s = useEditor.getState(); if (s.project) saveProject(s.project); }; window.addEventListener("beforeunload", h); window.addEventListener("pagehide", h); return () => { window.removeEventListener("beforeunload", h); window.removeEventListener("pagehide", h); }; }, []);

  /* ---- keyboard shortcuts ---- */
  useEffect(() => {
    if (route !== "editor") return;
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { if (typing && !s.editingTextId) return; e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); s.redo(); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveWithThumb().then(() => toast("Saved on this device")); return; }
      if (mod && e.key.toLowerCase() === "e") { e.preventDefault(); setShowExport(true); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); s.copy(); return; }
      if (mod && e.key.toLowerCase() === "v") { e.preventDefault(); s.paste(); return; }
      if (mod && e.key.toLowerCase() === "x") { e.preventDefault(); s.copy(); s.deleteSelected(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); s.duplicateSelected(); return; }
      if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); s.selectAll(); return; }
      if (mod && e.key.toLowerCase() === "g") { e.preventDefault(); e.shiftKey ? s.ungroupSelected() : s.groupSelected(); return; }
      if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); s.setZoom(s.zoom * 1.2); return; }
      if (mod && e.key === "-") { e.preventDefault(); s.setZoom(s.zoom / 1.2); return; }
      if (mod && e.key === "0") { e.preventDefault(); (window as any).__fitCanvas?.(); return; }
      if (mod && e.key === "1") { e.preventDefault(); s.setZoom(1); return; }
      if (mod && e.key === "]") { e.preventDefault(); s.selection.forEach((id) => s.reorder(id, e.shiftKey ? "top" : "up")); return; }
      if (mod && e.key === "[") { e.preventDefault(); s.selection.forEach((id) => s.reorder(id, e.shiftKey ? "bottom" : "down")); return; }
      if (e.key === "Delete" || e.key === "Backspace") { if (s.selection.length) { e.preventDefault(); s.deleteSelected(); } return; }
      if (e.key === "Escape") { if (cropId) setCropId(null); else if (s.fullscreen) s.toggle("fullscreen"); else s.clearSelection(); return; }
      if (e.key.startsWith("Arrow") && s.selection.length) { e.preventDefault(); const d = e.shiftKey ? 10 : 1; s.nudge(e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0); return; }
      if (e.key === "Enter" && s.selection.length === 1) { const el = s.page()?.elements.find((x) => x.id === s.selection[0]); if (el?.type === "text") { e.preventDefault(); s.setEditingText(el.id); } return; }
      if (!mod) {
        if (e.key.toLowerCase() === "t") { s.setTool("text"); const p = s.project!; const size = Math.round(48 * Math.min(p.width, p.height) / 1080); s.addElement(newText("Your text here", { fontSize: size, width: size * 8, height: size * 1.2, x: (p.width - size * 8) / 2, y: (p.height - size * 1.2) / 2 })); }
        if (e.key.toLowerCase() === "r") { const p = s.project!; const sz = Math.round(p.width * 0.25); s.addElement(newShape("rect", { width: sz, height: sz, x: (p.width - sz) / 2, y: (p.height - sz) / 2 })); }
        if (e.key.toLowerCase() === "o") { const p = s.project!; const sz = Math.round(p.width * 0.25); s.addElement(newShape("circle", { width: sz, height: sz, x: (p.width - sz) / 2, y: (p.height - sz) / 2 })); }
        if (e.key.toLowerCase() === "l") { s.setTool("layers"); s.setRightTab("layers"); }
        if (e.key.toLowerCase() === "f") { s.toggle("fullscreen"); }
        if (e.key === "?") setShowShortcuts(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [route, cropId, saveWithThumb]);

  // paste images from clipboard
  useEffect(() => {
    if (route !== "editor") return;
    const onPaste = async (e: ClipboardEvent) => {
      const s = useEditor.getState();
      const t = e.target as HTMLElement; if (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      const f = item.getAsFile(); if (!f) return;
      const { readFileAsDataURL, downscaleImage } = await import("@/lib/exporter");
      const { newImage } = await import("@/lib/defaults");
      const raw = await readFileAsDataURL(f); const { dataUrl, w, h } = await downscaleImage(raw, 3000);
      const id = s.addAsset(dataUrl); const p = s.project!; const r = Math.min((p.width * 0.6) / w, (p.height * 0.6) / h);
      const el = newImage(id, w, h, Math.round(w * r), Math.round(h * r)); el.x = (p.width - el.width) / 2; el.y = (p.height - el.height) / 2;
      s.addElement(el);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [route]);

  // fullscreen API sync
  useEffect(() => {
    if (st.fullscreen) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    const onFs = () => { if (!document.fullscreenElement && useEditor.getState().fullscreen) useEditor.setState({ fullscreen: false }); };
    document.addEventListener("fullscreenchange", onFs); return () => document.removeEventListener("fullscreenchange", onFs);
  }, [st.fullscreen]);

  if (route === "home" || !st.project) return <><Home onOpen={openProject} onCreate={createProject} /><Toasts />{showNew && <NewProjectDialog onClose={() => setShowNew(false)} onCreate={createProject} />}</>;

  const p = st.project;
  const canUndo = st.past.length > 0, canRedo = st.future.length > 0;
  const rightTab = st.selection.length ? st.rightTab : st.rightTab;

  const toolPanel = () => {
    switch (st.tool) {
      case "text": return <TextPanel />;
      case "shapes": return <ShapesPanel />;
      case "elements": return <ElementsPanel />;
      case "images": return <ImagesPanel />;
      case "background": return <BackgroundPanel />;
      case "pages": return <PagesPanel />;
      case "layers": return <><div className="panel-head">Layers</div><LayersPanel /></>;
      default: return <ElementsPanel />;
    }
  };
  const openTool = (t: Tool) => {
    if (isMobile) { if (st.tool === t && mobileSheet === "tool") { setMobileSheet(null); return; } st.setTool(t); setMobileSheet("tool"); return; }
    if (st.tool === t && st.panelOpen) st.toggle("panelOpen"); else { st.setTool(t); if (!st.panelOpen) st.toggle("panelOpen"); }
  };
  const importProj = async (f: File) => { try { const np = await importProjectFile(f); await saveProject(np); openProject(np); toast(`Imported "${np.name}"`); } catch (e: any) { toast(e.message || "Import failed", "err"); } };

  return (
    <div className={"app" + (st.fullscreen ? " fullscreen" : "")}>
      {/* ---------- Top bar ---------- */}
      <header className="topbar">
        <button className="ibtn" title="Back to projects" onClick={goHome}><ChevronLeft size={20} /></button>
        <div className="brand"><span className="brand-mark"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l8 18h-4l-4-9-4 9H4z" /></svg></span><span className="hide-m">RedCanvas</span></div>
        <div className="sep hide-m" />
        <div className="project-name"><input value={p.name} onChange={(e) => st.renameProject(e.target.value)} onBlur={() => st.save()} placeholder="Untitled design" /></div>
        <div className="sep" />
        <button className="ibtn" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={st.undo}><Undo2 size={18} /></button>
        <button className="ibtn" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={st.redo}><Redo2 size={18} /></button>
        <div className="sep hide-m" />
        <div className="zoom hide-m">
          <button className="ibtn" onClick={() => st.setZoom(st.zoom / 1.2)}><Minus size={14} /></button>
          <input value={`${Math.round(st.zoom * 100)}%`} onChange={() => {}} onKeyDown={(e) => { if (e.key === "Enter") { const n = parseFloat((e.target as HTMLInputElement).value); if (n) st.setZoom(n / 100); } }} onFocus={(e) => e.target.select()} />
          <button className="ibtn" onClick={() => st.setZoom(st.zoom * 1.2)}><Plus size={14} /></button>
        </div>
        <button className="ibtn hide-m" title="Fit to screen (Ctrl+0)" onClick={() => (window as any).__fitCanvas?.()}><Maximize2 size={17} /></button>
        <button className={"ibtn hide-m" + (st.showGrid ? " active" : "")} title="Grid" onClick={() => st.toggle("showGrid")}><Grid3X3 size={17} /></button>
        <button className={"ibtn hide-m" + (st.snapToGrid ? " active" : "")} title="Snap to grid" onClick={() => st.toggle("snapToGrid")}><Magnet size={17} /></button>
        <button className={"ibtn hide-m" + (st.showRulers ? " active" : "")} title="Rulers" onClick={() => st.toggle("showRulers")}><Ruler size={17} /></button>
        <span className="spacer" />
        {!online && <span className="pill warn hide-m" title="You are offline — the editor keeps working and saves locally"><WifiOff size={13} /> Offline</span>}
        <span className={"pill hide-m" + (st.dirty ? " gray" : "")} title="Projects are stored in this browser on this device">{st.dirty ? <><Save size={13} /> Saving…</> : <><Check size={13} /> Saved on device</>}</span>
        <button className="btn primary" onClick={() => setShowExport(true)}><Download size={15} /> <span className="hide-m">Export</span></button>
        <button className="ibtn" title="More" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}><MoreHorizontal size={20} /></button>
      </header>

      {/* ---------- Body ---------- */}
      <div className="body">
        <nav className="tools">
          {TOOLS.map((t) => <button key={t.id} className={"tool" + (st.tool === t.id && st.panelOpen ? " active" : "")} onClick={() => openTool(t.id)}><t.icon size={22} strokeWidth={1.8} />{t.label}</button>)}
        </nav>
        {!isMobile && <aside className={"panel" + (st.panelOpen ? "" : " closed")} key={st.tool}>{toolPanel()}</aside>}
        <main style={{ position: "relative", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Canvas cropId={cropId} onCropDone={() => setCropId(null)} />
          <PagesBar />
          {showNote && !isMobile && (
            <div className="storage-note">
              <b><Info size={13} /> Stored on this device</b>
              Projects auto‑save to this browser’s local storage. They may be lost if you clear site data or uninstall the app. Export a <b>.redcanvas</b> backup from the menu.
              <button className="btn sm soft block" style={{ marginTop: 8 }} onClick={() => { setShowNote(false); setSetting("noteDismissed", true); }}>Got it</button>
            </div>
          )}
          {st.fullscreen && <button className="btn ghost" style={{ position: "absolute", top: 12, right: 12, zIndex: 20 }} onClick={() => st.toggle("fullscreen")}><Minimize2 size={15} /> Exit fullscreen</button>}
        </main>
        {!isMobile && (
          <aside className="right">
            <div className="tabs">
              <button className={"tab" + (rightTab === "props" ? " active" : "")} onClick={() => st.setRightTab("props")}>Properties</button>
              <button className={"tab" + (rightTab === "layers" ? " active" : "")} onClick={() => st.setRightTab("layers")}>Layers ({st.page()?.elements.length ?? 0})</button>
            </div>
            {rightTab === "props" ? <PropertiesPanel onCrop={(id) => setCropId(id)} /> : <LayersPanel />}
          </aside>
        )}
      </div>

      {/* ---------- Mobile ---------- */}
      {isMobile && (
        <>
          <nav className="mobile-nav">
            <button className={"tool" + (mobileSheet === "props" ? " active" : "")} onClick={() => setMobileSheet(mobileSheet === "props" ? null : "props")}><SlidersHorizontal size={20} />Edit</button>
            {TOOLS.map((t) => <button key={t.id} className={"tool" + (st.tool === t.id && mobileSheet === "tool" ? " active" : "")} onClick={() => openTool(t.id)}><t.icon size={20} strokeWidth={1.8} />{t.label}</button>)}
            <button className="tool" onClick={() => (window as any).__fitCanvas?.()}><Maximize2 size={20} />Fit</button>
          </nav>
          {mobileSheet && (
            <div className="mobile-sheet">
              <div className="grab" onClick={() => setMobileSheet(null)} />
              <button className="ibtn sm" style={{ position: "absolute", right: 8, top: 8 }} onClick={() => setMobileSheet(null)}><X size={16} /></button>
              {mobileSheet === "tool" ? <div className="panel">{toolPanel()}</div> : (
                <div className="right">
                  <div className="tabs">
                    <button className={"tab" + (rightTab === "props" ? " active" : "")} onClick={() => st.setRightTab("props")}>Properties</button>
                    <button className={"tab" + (rightTab === "layers" ? " active" : "")} onClick={() => st.setRightTab("layers")}>Layers</button>
                  </div>
                  {rightTab === "props" ? <PropertiesPanel onCrop={(id) => { setCropId(id); setMobileSheet(null); }} /> : <LayersPanel />}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ---------- Menu ---------- */}
      {menu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 149 }} onPointerDown={() => setMenu(null)} />
          <div className="menu-pop" style={{ top: menu.bottom + 6, right: Math.max(8, window.innerWidth - menu.right) }}>
            <button onClick={() => { setMenu(null); setShowNew(true); }}><PlusSquare size={16} /> New design</button>
            <button onClick={() => { setMenu(null); goHome(); }}><HomeIcon size={16} /> All projects</button>
            <hr />
            <button onClick={() => { setMenu(null); saveWithThumb().then(() => toast("Saved on this device")); }}><Save size={16} /> Save now <kbd>Ctrl+S</kbd></button>
            <button onClick={() => { setMenu(null); exportProjectFile(p); toast("Project file downloaded"); }}><FileJson size={16} /> Export project file (.redcanvas)</button>
            <button onClick={() => { setMenu(null); fileRef.current?.click(); }}><Upload size={16} /> Import project file</button>
            <button onClick={() => { setMenu(null); setShowExport(true); }}><Download size={16} /> Export image <kbd>Ctrl+E</kbd></button>
            <hr />
            <button onClick={() => { setMenu(null); st.toggle("fullscreen"); }}><Maximize2 size={16} /> Fullscreen canvas <kbd>F</kbd></button>
            <button onClick={() => { setMenu(null); st.toggle("showRulers"); }}><Ruler size={16} /> {st.showRulers ? "Hide" : "Show"} rulers</button>
            <button onClick={() => { setMenu(null); st.toggle("showGuides"); }}><Sparkles size={16} /> {st.showGuides ? "Hide" : "Show"} guides</button>
            <button onClick={() => { setMenu(null); setShowShortcuts(true); }}><Keyboard size={16} /> Keyboard shortcuts <kbd>?</kbd></button>
            <hr />
            <button onClick={() => { setMenu(null); setShowWarn(true); }}><AlertTriangle size={16} /> About local storage</button>
            {installEvt && <button onClick={() => { setMenu(null); installEvt.prompt(); setInstallEvt(null); }}><Download size={16} /> Install app on this device</button>}
          </div>
        </>
      )}
      <input ref={fileRef} type="file" accept=".redcanvas,.json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importProj(f); e.target.value = ""; }} />

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showWarn && <StorageWarning onClose={() => { setShowWarn(false); setSetting("warnSeen", true); }} />}
      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} onCreate={(n, w, h) => { setShowNew(false); saveWithThumb().then(() => createProject(n, w, h)); }} />}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      <Toasts />
    </div>
  );
}

function PagesBar() {
  const st = useEditor(); const p = st.project!;
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const out: Record<string, string> = {};
      for (const pg of p.pages) { try { const c = await renderPage(p, pg, Math.min(1, 160 / p.width, 100 / p.height)); out[pg.id] = c.toDataURL(); } catch {} }
      setThumbs(out);
    }, 600);
  }, [p]);
  const ratio = p.width / p.height; const h = 56; const w = Math.max(40, Math.min(110, h * ratio));
  return (
    <div className="pages-bar">
      <div className="pages-strip">
        {p.pages.map((pg, i) => (
          <div key={pg.id} className={"page-thumb" + (i === st.pageIndex ? " active" : "")} style={{ width: w, height: h }} onClick={() => st.setPageIndex(i)} title={pg.name}>
            {thumbs[pg.id] ? <img src={thumbs[pg.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <span style={{ fontSize: 10, color: "var(--muted)" }}>{i + 1}</span>}
            <span className="num">{i + 1}</span>
            <span className="acts" onClick={(e) => e.stopPropagation()}>
              <button className="ibtn sm" style={{ width: 20, height: 20 }} title="Duplicate page" onClick={() => st.duplicatePage(i)}><Copy size={11} /></button>
              {p.pages.length > 1 && <button className="ibtn sm danger" style={{ width: 20, height: 20 }} title="Delete page" onClick={() => { if (confirm("Delete this page?")) st.deletePage(i); }}><Trash2 size={11} /></button>}
            </span>
          </div>
        ))}
        <button className="page-add" style={{ height: h }} title="Add page" onClick={st.addPage}><Plus size={18} /></button>
      </div>
    </div>
  );
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["Ctrl/⌘ + Z", "Undo"], ["Ctrl/⌘ + Shift + Z", "Redo"], ["Ctrl/⌘ + C / V / X", "Copy / Paste / Cut"], ["Ctrl/⌘ + D", "Duplicate"], ["Ctrl/⌘ + A", "Select all"],
    ["Ctrl/⌘ + G", "Group"], ["Ctrl/⌘ + Shift + G", "Ungroup"], ["Ctrl/⌘ + ] / [", "Bring forward / send backward"], ["Ctrl/⌘ + S", "Save now"], ["Ctrl/⌘ + E", "Export image"],
    ["Ctrl/⌘ + 0 / 1", "Fit to screen / 100%"], ["Ctrl/⌘ + scroll", "Zoom"], ["Space + drag", "Pan canvas"], ["Arrows / Shift + arrows", "Nudge 1px / 10px"], ["Shift + drag", "Constrain / keep ratio"],
    ["Double‑click text", "Edit text"], ["Double‑click image", "Crop image"], ["T / R / O", "Add text / rectangle / circle"], ["L", "Layers"], ["F", "Fullscreen"], ["Delete", "Delete selection"], ["Esc", "Deselect"],
  ];
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
        {rows.map(([k, d]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line-2)", fontSize: 12.5 }}><span style={{ color: "var(--muted)" }}>{d}</span><span className="kbd-hint"><kbd>{k}</kbd></span></div>)}
      </div>
    </Modal>
  );
}
