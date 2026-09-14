"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pipette, Plus, Trash2 } from "lucide-react";
import { useEditor } from "@/store/editor";
import { SOLID_PALETTE, GRADIENT_PRESETS } from "@/lib/defaults";
import type { Fill, Gradient } from "@/lib/types";
import { gradientCss } from "@/lib/render";
import { usePopover, Slider, Seg, toast } from "./ui";

/* ---- color math ---- */
function hexToHsva(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hue = 0;
  if (d) { if (max === r) hue = ((g - b) / d) % 6; else if (max === g) hue = (b - r) / d + 2; else hue = (r - g) / d + 4; hue *= 60; if (hue < 0) hue += 360; }
  return { h: hue, s: max ? d / max : 0, v: max, a };
}
function hsvaToHex(h: number, s: number, v: number, a = 1) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return "#" + to(r) + to(g) + to(b) + (a < 1 ? Math.round(a * 255).toString(16).padStart(2, "0") : "");
}
const isHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s);

const peekOn = (el: HTMLElement) => { el.classList.add("peeking"); document.dispatchEvent(new CustomEvent("rc-peek", { detail: true })); };
const peekOff = () => { document.querySelectorAll(".peeking").forEach((r) => r.classList.remove("peeking")); document.dispatchEvent(new CustomEvent("rc-peek", { detail: false })); };
export function ColorPanel({ value, onChange, onCommit, alpha = true }: { value: string; onChange: (hex: string) => void; onCommit?: () => void; alpha?: boolean }) {
  const safe = isHex(value) ? value : "#000000";
  const [hsva, setHsva] = useState(() => hexToHsva(safe));
  const [txt, setTxt] = useState(safe);
  const satRef = useRef<HTMLDivElement>(null);
  const recent = useEditor((s) => s.recentColors);
  const addRecent = useEditor((s) => s.addRecentColor);
  const setEyedropper = useEditor((s) => s.setEyedropper);

  useEffect(() => { if (isHex(value) && value.toLowerCase() !== hsvaToHex(hsva.h, hsva.s, hsva.v, hsva.a).toLowerCase()) { setHsva(hexToHsva(value)); } setTxt(value); }, [value]); // eslint-disable-line

  const emit = (n: typeof hsva) => { setHsva(n); const hex = hsvaToHex(n.h, n.s, n.v, n.a); setTxt(hex); onChange(hex); };
  const commit = () => { addRecent(hsvaToHex(hsva.h, hsva.s, hsva.v, hsva.a)); onCommit?.(); };

  const onSat = (e: React.PointerEvent) => {
    const el = satRef.current!; el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent | React.PointerEvent) => {
      const r = el.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), v = 1 - Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
      emit({ ...hsva, s, v });
    };
    move(e);
    const up = () => { el.removeEventListener("pointermove", move as any); el.removeEventListener("pointerup", up); commit(); };
    el.addEventListener("pointermove", move as any); el.addEventListener("pointerup", up);
  };

  const eyedrop = async () => {
    if ("EyeDropper" in window) {
      try { const r = await new (window as any).EyeDropper().open(); emit({ ...hexToHsva(r.sRGBHex), a: hsva.a }); commit(); } catch {}
    } else {
      toast("Click on the canvas to sample a color");
      setEyedropper((hex) => { emit({ ...hexToHsva(hex), a: hsva.a }); commit(); });
    }
  };

  const hueHex = hsvaToHex(hsva.h, 1, 1);
  const cur = hsvaToHex(hsva.h, hsva.s, hsva.v);
  return (
    <div>
      <div ref={satRef} className="cp-sat" style={{ ["--hue" as any]: hueHex }} onPointerDown={(e) => { peekOn(e.currentTarget); onSat(e); }} onPointerUp={peekOff} onPointerCancel={peekOff}>
        <div className="cp-cursor" style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%`, background: cur }} />
      </div>
      <input type="range" className="cp-hue" onPointerDown={(e) => peekOn(e.currentTarget)} onPointerCancel={peekOff} min={0} max={360} value={hsva.h} onChange={(e) => emit({ ...hsva, h: +e.target.value })} onPointerUp={() => { peekOff(); commit(); }} />
      {alpha && <input type="range" className="cp-alpha" onPointerDown={(e) => peekOn(e.currentTarget)} onPointerCancel={peekOff} style={{ ["--c" as any]: cur }} min={0} max={1} step={0.01} value={hsva.a} onChange={(e) => emit({ ...hsva, a: +e.target.value })} onPointerUp={() => { peekOff(); commit(); }} />}
      <div className="row" style={{ marginTop: 10 }}>
        <div className="field" style={{ fontFamily: "ui-monospace, monospace" }}>
          <span className="color-chip" style={{ ["--c" as any]: txt }} />
          <input value={txt} onChange={(e) => { setTxt(e.target.value); if (isHex(e.target.value)) { setHsva(hexToHsva(e.target.value)); onChange(e.target.value); } }} onBlur={commit} spellCheck={false} />
        </div>
        <button className="ibtn" title="Eyedropper" onClick={eyedrop}><Pipette size={16} /></button>
      </div>
      {recent.length > 0 && <>
        <div className="section-title" style={{ margin: "10px 0 6px" }}>Recent</div>
        <div className="grid-6">{recent.map((c) => <button key={c} className="swatch" style={{ background: c }} onClick={() => { emit({ ...hexToHsva(c) }); commit(); }} title={c} />)}</div>
      </>}
      <div className="section-title" style={{ margin: "10px 0 6px" }}>Palette</div>
      <div className="grid-6">{SOLID_PALETTE.map((c) => <button key={c} className={"swatch" + (c === cur ? " active" : "")} style={{ background: c }} onClick={() => { emit({ ...hexToHsva(c), a: hsva.a }); commit(); }} title={c} />)}</div>
    </div>
  );
}

export function ColorButton({ value, onChange, onCommit, label, alpha }: { value: string; onChange: (v: string) => void; onCommit?: () => void; label?: string; alpha?: boolean }) {
  const pop = usePopover();
  return (
    <>
      <button className="color-btn" onClick={pop.open}>
        <span className="color-chip" style={{ ["--c" as any]: value }} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{label ?? value.toUpperCase()}</span>
      </button>
      {pop.anchor && <div ref={pop.ref} className="popover" style={pop.style(260, 460)}><ColorPanel value={value} onChange={onChange} onCommit={onCommit} alpha={alpha} /></div>}
    </>
  );
}

/* ---- Gradient editor ---- */
export function GradientEditor({ value, onChange, onCommit }: { value: Gradient; onChange: (g: Gradient) => void; onCommit?: () => void }) {
  const [active, setActive] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const stop = value.stops[active] ?? value.stops[0];
  const setStops = (stops: Gradient["stops"]) => onChange({ ...value, stops });

  const dragStop = (i: number, e: React.PointerEvent) => {
    e.stopPropagation(); setActive(i);
    const el = barRef.current!; el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => { const r = el.getBoundingClientRect(); const p = Math.round(Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100))); const s = [...value.stops]; s[i] = { ...s[i], pos: p }; onChange({ ...value, stops: s }); };
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); onCommit?.(); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
  };
  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 10 }}>
        {GRADIENT_PRESETS.slice(0, 8).map((g, i) => <button key={i} className="swatch" style={{ background: gradientCss(g) }} onClick={() => { onChange({ ...g }); onCommit?.(); }} />)}
      </div>
      <div ref={barRef} className="grad-bar" style={{ background: gradientCss({ ...value, type: "linear", angle: 90 }) }}
        onPointerDown={(e) => { const r = barRef.current!.getBoundingClientRect(); const pos = Math.round(((e.clientX - r.left) / r.width) * 100); const s = [...value.stops, { color: stop.color, pos }].sort((a, b) => a.pos - b.pos); setStops(s); setActive(s.findIndex((x) => x.pos === pos)); onCommit?.(); }}>
        {value.stops.map((s, i) => <div key={i} className={"grad-stop" + (i === active ? " active" : "")} style={{ left: `${s.pos}%`, background: s.color }} onPointerDown={(e) => dragStop(i, e)} />)}
      </div>
      <div className="row">
        <Seg value={value.type} options={[{ value: "linear", label: "Linear" }, { value: "radial", label: "Radial" }]} onChange={(t) => { onChange({ ...value, type: t }); onCommit?.(); }} />
        <button className="ibtn" title="Remove stop" disabled={value.stops.length <= 2} onClick={() => { const s = value.stops.filter((_, i) => i !== active); setStops(s); setActive(0); onCommit?.(); }}><Trash2 size={15} /></button>
        <button className="ibtn" title="Add stop" onClick={() => { const s = [...value.stops, { color: stop.color, pos: 50 }].sort((a, b) => a.pos - b.pos); setStops(s); onCommit?.(); }}><Plus size={15} /></button>
      </div>
      {value.type === "linear" && <Slider label="Angle" value={value.angle} min={0} max={360} onChange={(a) => onChange({ ...value, angle: a })} onCommit={onCommit} format={(v) => `${v}°`} />}
      <div className="section-title" style={{ margin: "8px 0 6px" }}>Stop {active + 1} color</div>
      <ColorPanel value={stop.color} onChange={(c) => { const s = [...value.stops]; s[active] = { ...s[active], color: c }; setStops(s); }} onCommit={onCommit} alpha={false} />
    </div>
  );
}

export function FillButton({ value, onChange, onCommit }: { value: Fill; onChange: (f: Fill) => void; onCommit?: () => void }) {
  const pop = usePopover();
  const preview = useMemo(() => (value.type === "gradient" ? gradientCss(value.gradient) : value.color), [value]);
  return (
    <>
      <button className="color-btn" onClick={pop.open}>
        <span className="color-chip" style={{ ["--c" as any]: preview }} />
        <span style={{ flex: 1 }}>{value.type === "gradient" ? "Gradient" : value.color.toUpperCase()}</span>
      </button>
      {pop.anchor && (
        <div ref={pop.ref} className="popover" style={{ ...pop.style(260, 520), maxHeight: "80vh", overflowY: "auto" }}>
          <Seg value={value.type} options={[{ value: "solid", label: "Solid" }, { value: "gradient", label: "Gradient" }]} onChange={(t) => { onChange({ ...value, type: t }); onCommit?.(); }} />
          <div style={{ height: 10 }} />
          {value.type === "solid"
            ? <ColorPanel value={value.color} onChange={(c) => onChange({ ...value, color: c })} onCommit={onCommit} />
            : <GradientEditor value={value.gradient} onChange={(g) => onChange({ ...value, gradient: g })} onCommit={onCommit} />}
        </div>
      )}
    </>
  );
}
