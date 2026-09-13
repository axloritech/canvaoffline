"use client";
import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { create } from "zustand";

export function Stepper({ value, onChange, min = -Infinity, max = Infinity, step = 1, suffix, onCommit }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; onCommit?: () => void }) {
  const [txt, setTxt] = useState(String(Math.round(value * 100) / 100));
  useEffect(() => setTxt(String(Math.round(value * 100) / 100)), [value]);
  const set = (v: number) => { const c = Math.min(max, Math.max(min, v)); onChange(Math.round(c * 100) / 100); onCommit?.(); };
  return (
    <div className="stepper">
      <button onClick={() => set(value - step)} aria-label="decrease"><Minus size={13} /></button>
      <input value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={() => { const n = parseFloat(txt); if (!Number.isNaN(n)) set(n); else setTxt(String(value)); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} inputMode="decimal" />
      {suffix && <span className="unit" style={{ paddingRight: 6, fontSize: 10.5, color: "var(--muted)", fontWeight: 600 }}>{suffix}</span>}
      <button onClick={() => set(value + step)} aria-label="increase"><Plus size={13} /></button>
    </div>
  );
}

export function NumField({ label, value, onChange, min, max, step = 1, suffix, onCommit }: { label?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; onCommit?: () => void }) {
  const [txt, setTxt] = useState(String(Math.round(value * 100) / 100));
  useEffect(() => setTxt(String(Math.round(value * 100) / 100)), [value]);
  const commit = () => { const n = parseFloat(txt); if (!Number.isNaN(n)) { onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))); onCommit?.(); } else setTxt(String(value)); };
  return (
    <div className="field">
      {label && <span className="pre">{label}</span>}
      <input value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={commit} inputMode="decimal"
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "ArrowUp") { e.preventDefault(); onChange(value + step); } if (e.key === "ArrowDown") { e.preventDefault(); onChange(value - step); } }} />
      {suffix && <span className="unit">{suffix}</span>}
    </div>
  );
}

export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, format, onCommit }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string; onCommit?: () => void }) {
  return (
    <div className="slider-row">
      <span className="label">{label}</span>
      <input type="range" className="slider" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerDown={(e) => { const row = e.currentTarget.closest(".slider-row"); row?.classList.add("peeking"); document.dispatchEvent(new CustomEvent("rc-peek", { detail: true })); }}
        onPointerUp={() => { onCommit?.(); document.querySelectorAll(".slider-row.peeking").forEach((r) => r.classList.remove("peeking")); document.dispatchEvent(new CustomEvent("rc-peek", { detail: false })); }}
        onPointerCancel={() => { document.querySelectorAll(".slider-row.peeking").forEach((r) => r.classList.remove("peeking")); document.dispatchEvent(new CustomEvent("rc-peek", { detail: false })); }}
        onKeyUp={onCommit} />
      <span className="val">{format ? format(value) : Math.round(value)}</span>
    </div>
  );
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={"switch" + (on ? " on" : "")} onClick={() => onChange(!on)} role="switch" aria-checked={on} />;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => <button key={o.value} className={o.value === value ? "active" : ""} onClick={() => onChange(o.value)} title={o.title}>{o.label}</button>)}
    </div>
  );
}

export function Select<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="field">
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--muted)", flexShrink: 0 }}><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}

export const CompactCtx = React.createContext<{ compact: boolean; open: string | null; setOpen: (t: string | null) => void }>({ compact: false, open: null, setOpen: () => {} });
export function PropGroup({ title, right, children, defaultOpen = true }: { title: string; right?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const ctx = React.useContext(CompactCtx);
  const [localOpen, setLocalOpen] = React.useState(defaultOpen);
  const open = ctx.compact ? ctx.open === title : localOpen;
  const toggle = () => (ctx.compact ? ctx.setOpen(open ? null : title) : setLocalOpen(!open));
  return (
    <div className={"prop-group" + (open ? " open" : " collapsed")}>
      <div className="prop-title" onClick={(e) => { if ((e.target as HTMLElement).closest(".switch,button,input,select")) return; toggle(); }} role="button" aria-expanded={open}>
        <span className="prop-title-text"><svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>{title}</span>
        <span className="prop-title-right" onClick={(e) => e.stopPropagation()}>{right}</span>
      </div>
      {open && <div className="prop-body">{children}</div>}
    </div>
  );
}

/* ---- Toasts ---- */
interface Toast { id: number; text: string; type?: "ok" | "err" }
const useToastStore = create<{ toasts: Toast[]; push: (t: string, type?: "ok" | "err") => void }>((set, get) => ({
  toasts: [],
  push: (text, type = "ok") => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { id, text, type }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600);
  },
}));
export const toast = (t: string, type?: "ok" | "err") => useToastStore.getState().push(t, type);
export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  return <div className="toast-wrap">{toasts.map((t) => <div key={t.id} className={"toast" + (t.type === "err" ? " err" : "")}>{t.text}</div>)}</div>;
}

/* ---- Popover anchor helper ---- */
export function usePopover() {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAnchor(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAnchor(null); };
    setTimeout(() => { document.addEventListener("pointerdown", onDown); document.addEventListener("keydown", onKey); }, 0);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [anchor]);
  const open = (e: React.MouseEvent) => setAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
  const close = () => setAnchor(null);
  const style = (w = 260, h = 380): React.CSSProperties => {
    if (!anchor) return {};
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = anchor.left, top = anchor.bottom + 6;
    if (left + w > vw - 8) left = vw - w - 8;
    if (left < 8) left = 8;
    if (top + h > vh - 8) top = Math.max(8, anchor.top - h - 6);
    return { left, top };
  };
  return { anchor, open, close, ref, style };
}

export function Modal({ title, onClose, children, foot, wide }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"modal" + (wide ? " wide" : "")}>
        <div className="modal-head">{title}<button className="ibtn" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

export const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
export function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => { const mq = window.matchMedia("(max-width: 900px)"); const f = () => setM(mq.matches); f(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  return m;
}
