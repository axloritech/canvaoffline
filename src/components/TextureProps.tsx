"use client";
import React, { useMemo } from "react";
import { Film, Shuffle } from "lucide-react";
import type { Texture, TextureKind } from "@/lib/types";
import { TEXTURE_GROUPS, TEXTURE_LABEL, BLEND_MODES, defaultTexture, textureTile } from "@/lib/texture";
import { PropGroup, Slider, Switch, Select } from "./ui";
import { ColorButton } from "./ColorPicker";
import { useEditor } from "@/store/editor";

/** Texture & film-effects editor shared by images, shapes and the page background */
export function TextureProps({ value, onChange, embedded }: { value?: Texture; onChange: (t: Texture | undefined, history?: boolean) => void; embedded?: boolean }) {
  const st = useEditor();
  const t = value;
  const set = (p: Partial<Texture>, history = true) => onChange({ ...(t ?? defaultTexture()), ...p }, history);
  const live = (p: Partial<Texture>) => set(p, false);
  const commit = () => { st.commit(); st.save(); };
  const body = (
    <>
      <div className="tex-grid">
        {TEXTURE_GROUPS.map((g) => (
          <React.Fragment key={g.title}>
            <div className="tex-group-title">{g.title}</div>
            {g.items.map((it) => <TextureTile key={it.id} kind={it.id} active={!!t?.enabled && t.kind === it.id} onClick={() => onChange(t?.enabled && t.kind === it.id ? { ...t, enabled: false } : { ...defaultTexture(it.id), seed: t?.seed ?? Math.floor(Math.random() * 1e6) })} />)}
          </React.Fragment>
        ))}
      </div>
      {t?.enabled && (
        <div style={{ marginTop: 8 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <b style={{ fontSize: 12 }}><Film size={13} style={{ verticalAlign: -2 }} /> {TEXTURE_LABEL[t.kind]}</b>
            <button className="btn sm ghost" title="New random pattern" onClick={() => set({ seed: Math.floor(Math.random() * 1e6) })}><Shuffle size={13} /> Shuffle</button>
          </div>
          <Slider label="Intensity" value={t.intensity} onChange={(v) => live({ intensity: v })} onCommit={commit} format={(v) => `${Math.round(v)}%`} />
          <Slider label="Size" value={t.size} onChange={(v) => live({ size: v })} onCommit={commit} format={(v) => `${Math.round(v)}%`} />
          <Slider label="Scale" value={t.scale} min={25} max={400} onChange={(v) => live({ scale: v })} onCommit={commit} format={(v) => `${Math.round(v)}%`} />
          <Slider label="Opacity" value={t.opacity} onChange={(v) => live({ opacity: v })} onCommit={commit} format={(v) => `${Math.round(v)}%`} />
          <Slider label="Randomness" value={t.randomness} onChange={(v) => live({ randomness: v })} onCommit={commit} format={(v) => `${Math.round(v)}%`} />
          <div className="row" style={{ marginTop: 4 }}><span className="label w">Blend</span><Select value={t.blend} options={BLEND_MODES.map((b) => ({ value: b, label: b.replace("-", " ").replace(/^\w/, (c) => c.toUpperCase()) }))} onChange={(b) => set({ blend: b as Texture["blend"] })} /></div>
          <div className="row" style={{ marginTop: 6 }}><span className="label w">Color</span><ColorButton value={t.color} onChange={(c) => live({ color: c })} onCommit={commit} /></div>
          <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => onChange({ ...t, enabled: false })}>Remove texture</button>
        </div>
      )}
    </>
  );
  if (embedded) return <div style={{ marginTop: 10 }}><div className="section-title">Texture & film effects</div>{body}</div>;
  return <PropGroup title="Texture & film" right={<Switch on={!!t?.enabled} onChange={(v) => onChange(v ? (t ? { ...t, enabled: true } : defaultTexture()) : t ? { ...t, enabled: false } : undefined)} />} defaultOpen={!!t?.enabled}>{body}</PropGroup>;
}

function TextureTile({ kind, active, onClick }: { kind: TextureKind; active: boolean; onClick: () => void }) {
  // small preview: texture over a mid-grey/red gradient swatch
  const url = useMemo(() => { try { return textureTile({ ...defaultTexture(kind), seed: 7 }).toDataURL(); } catch { return ""; } }, [kind]);
  const d = defaultTexture(kind);
  return (
    <button className={"tex-tile" + (active ? " active" : "")} onClick={onClick} title={TEXTURE_LABEL[kind]}>
      <span className="tex-prev"><span style={{ position: "absolute", inset: 0, backgroundImage: `url(${url})`, backgroundSize: "128px 128px", opacity: Math.min(1, d.opacity / 100 + 0.25), mixBlendMode: d.blend as any }} /></span>
      <span className="tex-name">{TEXTURE_LABEL[kind]}</span>
    </button>
  );
}
