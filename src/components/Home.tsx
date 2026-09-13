"use client";
import React, { useEffect, useRef, useState } from "react";
import { Plus, Upload, Trash2, Copy, Instagram, Youtube, FileText, Presentation, Image as ImageIcon, Sparkles, WifiOff, AlertTriangle, HardDrive, Download } from "lucide-react";
import { listProjects, loadProject, deleteProject, saveProject, estimateStorage, requestPersistence } from "@/lib/db";
import type { ProjectMeta, Project } from "@/lib/types";
import { uid } from "@/lib/defaults";
import { NewProjectDialog, importProjectFile, exportProjectFile, StorageWarning } from "./Dialogs";
import { ImportDialog } from "./ImportDialog";
import { saveProject as persist } from "@/lib/db";
import { Wand2 } from "lucide-react";
import { toast } from "./ui";

const QUICK = [
  { label: "Instagram Post", sub: "1080 × 1080", w: 1080, h: 1080, icon: Instagram },
  { label: "Story / Reel", sub: "1080 × 1920", w: 1080, h: 1920, icon: Sparkles },
  { label: "YouTube Thumbnail", sub: "1280 × 720", w: 1280, h: 720, icon: Youtube },
  { label: "A4 Flyer", sub: "2480 × 3508", w: 2480, h: 3508, icon: FileText },
  { label: "Presentation", sub: "1920 × 1080", w: 1920, h: 1080, icon: Presentation },
  { label: "Logo", sub: "1000 × 1000", w: 1000, h: 1000, icon: ImageIcon },
];

export default function Home({ onOpen, onCreate }: { onOpen: (p: Project) => void; onCreate: (name: string, w: number, h: number) => void }) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [showWarn, setShowWarn] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [online, setOnline] = useState(true);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => listProjects().then(setProjects);
  useEffect(() => {
    refresh(); estimateStorage().then(setStorage); requestPersistence();
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    const bip = (e: any) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", bip);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("beforeinstallprompt", bip); };
  }, []);

  const open = async (id: string) => { const p = await loadProject(id); if (p) onOpen(p); else toast("Project could not be loaded", "err"); };
  const remove = async (m: ProjectMeta) => { if (!confirm(`Delete "${m.name}" permanently? This cannot be undone.`)) return; await deleteProject(m.id); refresh(); toast("Project deleted"); };
  const duplicate = async (m: ProjectMeta) => { const p = await loadProject(m.id); if (!p) return; const c = { ...structuredClone(p), id: uid(), name: p.name + " copy", updatedAt: Date.now(), createdAt: Date.now() }; await saveProject(c, m.thumbnail); refresh(); };
  const exportOne = async (m: ProjectMeta) => { const p = await loadProject(m.id); if (p) exportProjectFile(p); };
  const importFile = async (f: File) => { try { const p = await importProjectFile(f); await saveProject(p); refresh(); toast(`Imported "${p.name}"`); } catch (e: any) { toast(e.message || "Import failed", "err"); } };

  const fmt = (n: number) => n > 1e9 ? (n / 1e9).toFixed(2) + " GB" : n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : (n / 1e3).toFixed(0) + " KB";
  const ago = (t: number) => { const d = Date.now() - t; if (d < 60e3) return "just now"; if (d < 3600e3) return `${Math.floor(d / 60e3)} min ago`; if (d < 86400e3) return `${Math.floor(d / 3600e3)} h ago`; return new Date(t).toLocaleDateString(); };

  return (
    <div className="home">
      <div className="home-top"><div className="inner">
        <div className="brand"><span className="brand-mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l8 18h-4l-4-9-4 9H4z" /></svg></span><span>RedCanvas Studio</span></div>
        <span className="spacer" />
        {!online && <span className="pill warn"><WifiOff size={13} /> Offline — everything still works</span>}
        {installEvt && <button className="btn ghost sm" onClick={async () => { installEvt.prompt(); setInstallEvt(null); }}><Download size={14} /> Install app</button>}
        <input ref={fileRef} type="file" accept=".redcanvas,.json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
        <button className="btn ghost sm" onClick={() => setShowImport(true)}><Wand2 size={14} /> Import & Edit</button>
        <button className="btn ghost sm hide-m" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import project</button>
        <button className="btn primary" onClick={() => setShowNew(true)}><Plus size={16} /> New design</button>
      </div></div>

      <div className="home-main">
        <div className="hero">
          <div><h1>What will you design today?</h1><p>An offline‑first design editor. Fonts, tools and your projects live on this device — no account, no internet needed.</p></div>
          <button className="pill" style={{ height: 34 }} onClick={() => setShowWarn(true)}><AlertTriangle size={14} /> Projects are stored locally — read this</button>
        </div>

        <div className="quick">
          <button className="new" onClick={() => setShowNew(true)}><span className="ico"><Plus size={20} /></span><span><b>Custom size</b><small>Any dimensions & presets</small></span></button>
          <button onClick={() => setShowImport(true)} style={{ borderColor: "var(--red-100)", background: "var(--red-50)" }}><span className="ico" style={{ background: "#fff" }}><Wand2 size={20} /></span><span><b>Import & Edit</b><small>PNG/JPG → editable layers</small></span></button>
          {QUICK.map((q) => <button key={q.label} onClick={() => onCreate(q.label, q.w, q.h)}><span className="ico"><q.icon size={20} /></span><span><b>{q.label}</b><small>{q.sub}</small></span></button>)}
        </div>

        <div className="section-title" style={{ fontSize: 13, textTransform: "none", letterSpacing: 0, color: "var(--ink)", marginBottom: 14 }}>
          <span>Your projects <span style={{ color: "var(--muted)", fontWeight: 500 }}>({projects.length})</span></span>
          {storage && <span style={{ color: "var(--muted)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}><HardDrive size={13} /> {fmt(storage.usage)} used of {fmt(storage.quota)}</span>}
        </div>

        {projects.length === 0 ? (
          <div className="empty" style={{ background: "#fff", border: "1px dashed var(--line)", borderRadius: 16, padding: 50 }}>
            <Sparkles size={36} /><b>No projects yet</b>Create a new design or import a .redcanvas backup file.
          </div>
        ) : (
          <div className="projects">
            {projects.map((m) => (
              <div key={m.id} className="pcard" onClick={() => open(m.id)}>
                <div className="prev">{m.thumbnail ? <img src={m.thumbnail} alt="" /> : <ImageIcon size={28} color="#cfd2d8" />}</div>
                <div className="info"><b>{m.name}</b><small>{m.width} × {m.height} · {m.pageCount} page{m.pageCount > 1 ? "s" : ""} · {ago(m.updatedAt)}</small></div>
                <div className="menu" onClick={(e) => e.stopPropagation()}>
                  <button className="ibtn sm" title="Export backup" onClick={() => exportOne(m)}><Download size={14} /></button>
                  <button className="ibtn sm" title="Duplicate" onClick={() => duplicate(m)}><Copy size={14} /></button>
                  <button className="ibtn sm danger" title="Delete" onClick={() => remove(m)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="warn-box" style={{ marginTop: 36 }}>
          <AlertTriangle size={16} />
          <div><b>Local storage notice.</b> Projects are saved in this browser’s IndexedDB. They can be lost if you clear site data, uninstall the app or the browser evicts storage. Export important projects as <b>.redcanvas</b> files to back them up or move them to another device.</div>
        </div>
      </div>

      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} onCreate={(n, w, h) => { setShowNew(false); onCreate(n, w, h); }} />}
      {showWarn && <StorageWarning onClose={() => setShowWarn(false)} />}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onImported={async (p) => { setShowImport(false); await persist(p); onOpen(p); }} />}
    </div>
  );
}
