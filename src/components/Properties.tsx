"use client";
import React, { useState } from "react";
import * as Lucide from "lucide-react";
import { Bold, Italic, Underline, CaseUpper, AlignLeft, AlignCenter, AlignRight, AlignJustify, FlipHorizontal2, FlipVertical2, Lock, Unlock, Eye, EyeOff, Trash2, Copy, Group, Ungroup, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, ArrowUpToLine, ArrowDownToLine, ArrowUp, ArrowDown, Crop, RotateCcw, Layers as LayersIcon, GripVertical, Type as TypeIcon, Image as ImageIcon, Shapes, Minus, Sparkles, Box } from "lucide-react";
import { useEditor } from "@/store/editor";
import { FONTS } from "@/lib/fonts";
import { FILTER_PRESETS } from "@/lib/defaults";
import type { DesignElement, TextElement, ImageElement, ShapeElement, LineElement, IconElement, Shadow, Glow, Stroke, MaskKind } from "@/lib/types";
import { shapePath, maskSvgPath, imageFilterCss } from "@/lib/render";
import { ColorButton, FillButton } from "./ColorPicker";
import { NumField, Slider, Switch, Seg, Select, PropGroup, Stepper } from "./ui";

export function PropertiesPanel({ onCrop }: { onCrop: (id: string) => void }) {
  const st = useEditor();
  const page = st.page()!;
  const els = st.selection.map((id) => page.elements.find((e) => e.id === id)).filter(Boolean) as DesignElement[];
  if (!els.length) return <PageProps />;
  const single = els.length === 1 ? els[0] : null;
  const upd = (patch: Partial<DesignElement>, history = true) => st.updateElements(els.map((e) => e.id), () => patch, history);
  const commit = () => { st.save(); };

  return (
    <div className="right-body">
      {/* header */}
      <div className="row" style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 14, flex: 1 }}>{single ? typeLabel(single) : `${els.length} elements`}</b>
        {els.length > 1 && <button className="ibtn sm" title="Group (Ctrl+G)" onClick={st.groupSelected}><Group size={16} /></button>}
        {single?.type === "group" && <button className="ibtn sm" title="Ungroup" onClick={st.ungroupSelected}><Ungroup size={16} /></button>}
        <button className="ibtn sm" title="Duplicate" onClick={st.duplicateSelected}><Copy size={16} /></button>
        <button className="ibtn sm danger" title="Delete" onClick={st.deleteSelected}><Trash2 size={16} /></button>
      </div>

      {/* Alignment */}
      <PropGroup title="Align & arrange">
        <div className="row">
          <div className="seg">
            <button title="Align left" onClick={() => st.alignSelected("left")}><AlignStartVertical size={15} /></button>
            <button title="Align center" onClick={() => st.alignSelected("hcenter")}><AlignCenterVertical size={15} /></button>
            <button title="Align right" onClick={() => st.alignSelected("right")}><AlignEndVertical size={15} /></button>
            <button title="Align top" onClick={() => st.alignSelected("top")}><AlignStartHorizontal size={15} /></button>
            <button title="Align middle" onClick={() => st.alignSelected("vcenter")}><AlignCenterHorizontal size={15} /></button>
            <button title="Align bottom" onClick={() => st.alignSelected("bottom")}><AlignEndHorizontal size={15} /></button>
          </div>
        </div>
        <div className="row">
          {els.length > 2 && <div className="seg" style={{ flex: "0 0 auto", width: 70 }}><button title="Distribute horizontally" onClick={() => st.alignSelected("hdist")}><AlignHorizontalDistributeCenter size={15} /></button><button title="Distribute vertically" onClick={() => st.alignSelected("vdist")}><AlignVerticalDistributeCenter size={15} /></button></div>}
          {single && <div className="seg">
            <button title="Bring to front" onClick={() => st.reorder(single.id, "top")}><ArrowUpToLine size={15} /></button>
            <button title="Bring forward" onClick={() => st.reorder(single.id, "up")}><ArrowUp size={15} /></button>
            <button title="Send backward" onClick={() => st.reorder(single.id, "down")}><ArrowDown size={15} /></button>
            <button title="Send to back" onClick={() => st.reorder(single.id, "bottom")}><ArrowDownToLine size={15} /></button>
          </div>}
        </div>
      </PropGroup>

      {/* Transform */}
      {single && (
        <PropGroup title="Position & size">
          <div className="row two"><NumField label="X" value={single.x} onChange={(v) => moveWithChildren(single, v - single.x, 0)} /><NumField label="Y" value={single.y} onChange={(v) => moveWithChildren(single, 0, v - single.y)} /></div>
          <div className="row two"><NumField label="W" value={single.width} min={1} onChange={(v) => upd({ width: v })} /><NumField label="H" value={single.height} min={1} onChange={(v) => upd({ height: v })} /></div>
          <div className="row two">
            <NumField label="↻" value={single.rotation} suffix="°" onChange={(v) => upd({ rotation: v })} />
            <div className="seg" style={{ flex: "0 0 auto", width: 100 }}>
              <button title="Flip horizontal" className={single.flipX ? "active" : ""} onClick={() => upd({ flipX: !single.flipX })}><FlipHorizontal2 size={15} /></button>
              <button title="Flip vertical" className={single.flipY ? "active" : ""} onClick={() => upd({ flipY: !single.flipY })}><FlipVertical2 size={15} /></button>
              <button title="Reset rotation" onClick={() => upd({ rotation: 0 })}><RotateCcw size={14} /></button>
            </div>
          </div>
          <div className="row">
            <button className={"btn sm ghost"} style={{ flex: 1 }} onClick={() => st.toggleLock(single.id)}>{single.locked ? <><Lock size={13} /> Locked</> : <><Unlock size={13} /> Unlocked</>}</button>
            <button className={"btn sm ghost"} style={{ flex: 1 }} onClick={() => st.toggleHide(single.id)}>{single.hidden ? <><EyeOff size={13} /> Hidden</> : <><Eye size={13} /> Visible</>}</button>
          </div>
        </PropGroup>
      )}

      <PropGroup title="Transparency">
        <Slider label="Opacity" value={Math.round((single?.opacity ?? els[0].opacity) * 100)} onChange={(v) => upd({ opacity: v / 100 }, false)} onCommit={() => { st.commit(); commit(); }} format={(v) => `${v}%`} />
      </PropGroup>

      {single?.type === "text" && <TextProps el={single} />}
      {single?.type === "image" && <ImageProps el={single} onCrop={onCrop} />}
      {single?.type === "shape" && <ShapeProps el={single} />}
      {single?.type === "line" && <LineProps el={single} />}
      {single?.type === "icon" && <IconProps el={single} />}

      {(single || els.length > 1) && <EffectsProps els={els} />}
    </div>
  );

  function moveWithChildren(el: DesignElement, dx: number, dy: number) {
    st.commit();
    st.updateElements([el.id, ...(el.type === "group" ? el.children : [])], (e) => ({ x: e.x + dx, y: e.y + dy }), false);
  }
}

function typeLabel(el: DesignElement) { return { text: "Text", image: "Image", shape: "Shape", line: "Line", icon: "Icon", group: "Group" }[el.type]; }

/* ---------------- Text ---------------- */
function TextProps({ el }: { el: TextElement }) {
  const st = useEditor();
  const u = (p: Partial<TextElement>, h = true) => st.updateElement(el.id, p, h);
  const font = FONTS.find((f) => f.family === el.fontFamily);
  return (
    <>
      <PropGroup title="Font">
        <div className="row"><Select value={el.fontFamily} options={FONTS.map((f) => ({ value: f.family, label: f.family }))} onChange={(f) => u({ fontFamily: f })} /></div>
        <div className="row two">
          <Select value={String(el.fontWeight)} options={[{ value: "300", label: "Light" }, { value: "400", label: "Regular" }, { value: "500", label: "Medium" }, { value: "600", label: "Semibold" }, { value: "700", label: "Bold" }, { value: "800", label: "Extra bold" }, { value: "900", label: "Black" }]} onChange={(w) => u({ fontWeight: +w })} />
          <Stepper value={el.fontSize} min={4} max={2000} onChange={(v) => u({ fontSize: v }, false)} onCommit={() => st.commit()} />
        </div>
        <div className="row">
          <div className="seg">
            <button className={el.fontWeight >= 700 ? "active" : ""} title="Bold" onClick={() => u({ fontWeight: el.fontWeight >= 700 ? 400 : 700 })}><Bold size={15} /></button>
            <button className={el.italic ? "active" : ""} title="Italic" onClick={() => u({ italic: !el.italic })}><Italic size={15} /></button>
            <button className={el.underline ? "active" : ""} title="Underline" onClick={() => u({ underline: !el.underline })}><Underline size={15} /></button>
            <button className={el.uppercase ? "active" : ""} title="Uppercase" onClick={() => u({ uppercase: !el.uppercase })}><CaseUpper size={16} /></button>
          </div>
        </div>
        <div className="row">
          <Seg value={el.align} options={[{ value: "left", label: <AlignLeft size={15} /> }, { value: "center", label: <AlignCenter size={15} /> }, { value: "right", label: <AlignRight size={15} /> }, { value: "justify", label: <AlignJustify size={15} /> }]} onChange={(a) => u({ align: a })} />
        </div>
        {font && !font.bold && el.fontWeight >= 600 && <div style={{ fontSize: 11, color: "var(--muted)" }}>This font ships in one weight; bold is synthesized.</div>}
        <Slider label="Line height" value={el.lineHeight} min={0.5} max={3} step={0.05} onChange={(v) => u({ lineHeight: v }, false)} onCommit={() => st.commit()} format={(v) => v.toFixed(2)} />
        <Slider label="Letter spacing" value={el.letterSpacing} min={-20} max={100} step={0.5} onChange={(v) => u({ letterSpacing: v }, false)} onCommit={() => st.commit()} format={(v) => `${v}`} />
        <div className="row"><span className="label w">Auto width</span><Switch on={el.autoWidth} onChange={(v) => u({ autoWidth: v })} /></div>
      </PropGroup>
      <PropGroup title="Color">
        <div className="row"><FillButton value={el.fill} onChange={(f) => u({ fill: f }, false)} onCommit={() => { st.commit(); st.save(); }} /></div>
      </PropGroup>
      <StrokeProps stroke={el.stroke} onChange={(s, h) => u({ stroke: s }, h)} max={20} />
    </>
  );
}

/* ---------------- Image ---------------- */
function ImageProps({ el, onCrop }: { el: ImageElement; onCrop: (id: string) => void }) {
  const st = useEditor();
  const u = (p: Partial<ImageElement>, h = true) => st.updateElement(el.id, p, h);
  const f = el.filters;
  const uf = (p: Partial<ImageElement["filters"]>, h = false) => u({ filters: { ...f, ...p, preset: "custom" } }, h);
  const masks: MaskKind[] = ["none", "circle", "rounded", "hexagon", "diamond", "triangle", "star", "heart", "blob"];
  const src = st.project!.assets[el.assetId];
  return (
    <>
      <PropGroup title="Image">
        <div className="row">
          <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => onCrop(el.id)}><Crop size={14} /> Crop</button>
          <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => u({ crop: { x: 0, y: 0, w: 1, h: 1 }, height: el.width * (el.naturalH / el.naturalW) })}><RotateCcw size={14} /> Reset crop</button>
        </div>
        <Slider label="Corners" value={el.radius} min={0} max={Math.min(el.width, el.height) / 2} onChange={(v) => u({ radius: v }, false)} onCommit={() => st.commit()} />
      </PropGroup>
      <PropGroup title="Mask / frame shape">
        <div className="grid-6" style={{ marginBottom: 8 }}>
          {masks.map((m) => <button key={m} className={"tile" + (el.mask === m ? " active" : "")} title={m} onClick={() => u({ mask: m })}>
            {m === "none" ? <Lucide.Square size={16} /> : <svg viewBox="-2 -2 104 104"><path d={maskSvgPath(m, 100, 100)!} fill="currentColor" /></svg>}
          </button>)}
        </div>
        <div className="row"><span className="label w">Frame</span><Switch on={el.frame.enabled} onChange={(v) => u({ frame: { ...el.frame, enabled: v } })} /></div>
        {el.frame.enabled && <>
          <Slider label="Frame width" value={el.frame.width} min={1} max={80} onChange={(v) => u({ frame: { ...el.frame, width: v } }, false)} onCommit={() => st.commit()} />
          <div className="row"><span className="label w">Frame color</span><ColorButton value={el.frame.color} onChange={(c) => u({ frame: { ...el.frame, color: c } }, false)} onCommit={() => st.commit()} /></div>
        </>}
      </PropGroup>
      <PropGroup title="Filters">
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
          {Object.entries(FILTER_PRESETS).map(([name, p]) => (
            <button key={name} onClick={() => u({ filters: { ...f, ...p, preset: name } as any })} style={{ flexShrink: 0, textAlign: "center", fontSize: 10, fontWeight: 600, color: f.preset === name ? "var(--red)" : "var(--muted)" }}>
              <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", border: f.preset === name ? "2px solid var(--red)" : "1px solid var(--line)", marginBottom: 3 }}>
                {src && <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: imageFilterCss({ ...f, ...p, blur: 0 } as any) }} />}
              </div>{name}
            </button>
          ))}
        </div>
      </PropGroup>
      <PropGroup title="Adjustments" right={<button className="btn sm ghost" onClick={() => u({ filters: { ...FILTER_PRESETS.none, blur: 0, preset: "none" } as any })}>Reset</button>}>
        <Slider label="Brightness" value={f.brightness} min={0} max={200} onChange={(v) => uf({ brightness: v })} onCommit={() => st.commit()} />
        <Slider label="Contrast" value={f.contrast} min={0} max={200} onChange={(v) => uf({ contrast: v })} onCommit={() => st.commit()} />
        <Slider label="Saturation" value={f.saturation} min={0} max={300} onChange={(v) => uf({ saturation: v })} onCommit={() => st.commit()} />
        <Slider label="Hue" value={f.hue} min={-180} max={180} onChange={(v) => uf({ hue: v })} onCommit={() => st.commit()} format={(v) => `${v}°`} />
        <Slider label="Blur" value={f.blur} min={0} max={40} step={0.5} onChange={(v) => uf({ blur: v })} onCommit={() => st.commit()} />
        <Slider label="Grayscale" value={f.grayscale} min={0} max={100} onChange={(v) => uf({ grayscale: v })} onCommit={() => st.commit()} />
        <Slider label="Sepia" value={f.sepia} min={0} max={100} onChange={(v) => uf({ sepia: v })} onCommit={() => st.commit()} />
        <Slider label="Invert" value={f.invert} min={0} max={100} onChange={(v) => uf({ invert: v })} onCommit={() => st.commit()} />
      </PropGroup>
      <StrokeProps stroke={el.stroke} onChange={(s, h) => u({ stroke: s }, h)} max={60} title="Border" />
    </>
  );
}

/* ---------------- Shape / Line / Icon ---------------- */
function ShapeProps({ el }: { el: ShapeElement }) {
  const st = useEditor();
  const u = (p: Partial<ShapeElement>, h = true) => st.updateElement(el.id, p, h);
  return (
    <>
      <PropGroup title="Fill">
        <div className="row"><FillButton value={el.fill} onChange={(f) => u({ fill: f }, false)} onCommit={() => { st.commit(); st.save(); }} /></div>
        {(el.shape === "rounded" || el.shape === "rect") && <Slider label="Corners" value={el.radius} min={0} max={Math.min(el.width, el.height) / 2} onChange={(v) => u({ radius: v, shape: v > 0 ? "rounded" : "rect" }, false)} onCommit={() => st.commit()} />}
      </PropGroup>
      <StrokeProps stroke={el.stroke} onChange={(s, h) => u({ stroke: s }, h)} max={80} title="Border" />
    </>
  );
}
function LineProps({ el }: { el: LineElement }) {
  const st = useEditor();
  const u = (p: Partial<LineElement>, h = true) => st.updateElement(el.id, p, h);
  const heads = [{ value: "none", label: "None" }, { value: "arrow", label: "Arrow" }, { value: "circle", label: "Circle" }, { value: "square", label: "Square" }] as const;
  return (
    <PropGroup title="Line">
      <div className="row"><span className="label w">Color</span><ColorButton value={el.color} onChange={(c) => u({ color: c }, false)} onCommit={() => st.commit()} /></div>
      <Slider label="Thickness" value={el.thickness} min={1} max={100} onChange={(v) => u({ thickness: v }, false)} onCommit={() => st.commit()} />
      <div className="row"><span className="label w">Style</span><Seg value={el.dash} options={[{ value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" }, { value: "dotted", label: "Dotted" }]} onChange={(d) => u({ dash: d })} /></div>
      <div className="row"><span className="label w">Start</span><Select value={el.startHead} options={heads as any} onChange={(v) => u({ startHead: v as any })} /></div>
      <div className="row"><span className="label w">End</span><Select value={el.endHead} options={heads as any} onChange={(v) => u({ endHead: v as any })} /></div>
    </PropGroup>
  );
}
function IconProps({ el }: { el: IconElement }) {
  const st = useEditor();
  const u = (p: Partial<IconElement>, h = true) => st.updateElement(el.id, p, h);
  return (
    <PropGroup title="Icon">
      <div className="row"><span className="label w">Color</span><ColorButton value={el.color} onChange={(c) => u({ color: c }, false)} onCommit={() => st.commit()} /></div>
      <Slider label="Stroke" value={el.strokeWidth} min={0.5} max={4} step={0.25} onChange={(v) => u({ strokeWidth: v }, false)} onCommit={() => st.commit()} format={(v) => v.toFixed(2)} />
    </PropGroup>
  );
}

function StrokeProps({ stroke, onChange, max, title = "Stroke / outline" }: { stroke: Stroke; onChange: (s: Stroke, history?: boolean) => void; max: number; title?: string }) {
  const st = useEditor();
  return (
    <PropGroup title={title} right={<Switch on={stroke.enabled} onChange={(v) => onChange({ ...stroke, enabled: v })} />}>
      {stroke.enabled && <>
        <Slider label="Width" value={stroke.width} min={0} max={max} step={0.5} onChange={(v) => onChange({ ...stroke, width: v }, false)} onCommit={() => st.commit()} />
        <div className="row"><span className="label w">Color</span><ColorButton value={stroke.color} onChange={(c) => onChange({ ...stroke, color: c }, false)} onCommit={() => st.commit()} /></div>
      </>}
    </PropGroup>
  );
}

/* ---------------- Effects ---------------- */
function EffectsProps({ els }: { els: DesignElement[] }) {
  const st = useEditor();
  const ref = els[0];
  const ids = els.map((e) => e.id);
  const us = (p: Partial<Shadow>, h = true) => st.updateElements(ids, (e) => ({ shadow: { ...e.shadow, ...p } }), h);
  const ug = (p: Partial<Glow>, h = true) => st.updateElements(ids, (e) => ({ glow: { ...e.glow, ...p } }), h);
  const s = ref.shadow, g = ref.glow;
  return (
    <>
      <PropGroup title="Shadow" right={<Switch on={s.enabled} onChange={(v) => us({ enabled: v })} />}>
        {s.enabled && <>
          <div className="row two"><NumField label="X" value={s.x} onChange={(v) => us({ x: v })} /><NumField label="Y" value={s.y} onChange={(v) => us({ y: v })} /></div>
          <Slider label="Blur" value={s.blur} min={0} max={100} onChange={(v) => us({ blur: v }, false)} onCommit={() => st.commit()} />
          <Slider label="Opacity" value={s.opacity * 100} min={0} max={100} onChange={(v) => us({ opacity: v / 100 }, false)} onCommit={() => st.commit()} format={(v) => `${Math.round(v)}%`} />
          <div className="row"><span className="label w">Color</span><ColorButton value={s.color} onChange={(c) => us({ color: c }, false)} onCommit={() => st.commit()} alpha={false} /></div>
        </>}
      </PropGroup>
      <PropGroup title="Glow" right={<Switch on={g.enabled} onChange={(v) => ug({ enabled: v })} />}>
        {g.enabled && <>
          <Slider label="Size" value={g.blur} min={0} max={100} onChange={(v) => ug({ blur: v }, false)} onCommit={() => st.commit()} />
          <Slider label="Intensity" value={g.opacity * 100} min={0} max={100} onChange={(v) => ug({ opacity: v / 100 }, false)} onCommit={() => st.commit()} format={(v) => `${Math.round(v)}%`} />
          <div className="row"><span className="label w">Color</span><ColorButton value={g.color} onChange={(c) => ug({ color: c }, false)} onCommit={() => st.commit()} alpha={false} /></div>
        </>}
      </PropGroup>
    </>
  );
}

/* ---------------- Page props (nothing selected) ---------------- */
function PageProps() {
  const st = useEditor(); const p = st.project!;
  const [w, setW] = useState(p.width); const [h, setH] = useState(p.height);
  React.useEffect(() => { setW(p.width); setH(p.height); }, [p.width, p.height]);
  return (
    <div className="right-body">
      <b style={{ fontSize: 14, display: "block", marginBottom: 10 }}>Page</b>
      <PropGroup title="Canvas size">
        <div className="row two"><NumField label="W" value={w} min={16} max={12000} onChange={setW} /><NumField label="H" value={h} min={16} max={12000} onChange={setH} /></div>
        {(w !== p.width || h !== p.height) && <div className="row two">
          <button className="btn sm ghost" onClick={() => { st.resizeProject(w, h, false); setTimeout(() => (window as any).__fitCanvas?.(), 50); }}>Resize only</button>
          <button className="btn sm primary" onClick={() => { st.resizeProject(w, h, true); setTimeout(() => (window as any).__fitCanvas?.(), 50); }}>Resize & scale</button>
        </div>}
        <div className="row"><button className="btn sm ghost block" onClick={() => { st.resizeProject(p.height, p.width, true); setTimeout(() => (window as any).__fitCanvas?.(), 50); }}><Lucide.RotateCw size={13} /> Swap orientation</button></div>
      </PropGroup>
      <PropGroup title="Background">
        <button className="btn ghost sm block" onClick={() => st.setTool("background")}><Lucide.Paintbrush size={14} /> Edit background</button>
      </PropGroup>
      <PropGroup title="Canvas helpers">
        <div className="row"><span className="label" style={{ flex: 1 }}>Show grid</span><Switch on={st.showGrid} onChange={() => st.toggle("showGrid")} /></div>
        <div className="row"><span className="label" style={{ flex: 1 }}>Snap to grid</span><Switch on={st.snapToGrid} onChange={() => st.toggle("snapToGrid")} /></div>
        <div className="row"><span className="label" style={{ flex: 1 }}>Snap to objects</span><Switch on={st.snapToObjects} onChange={() => st.toggle("snapToObjects")} /></div>
        <div className="row"><span className="label" style={{ flex: 1 }}>Rulers</span><Switch on={st.showRulers} onChange={() => st.toggle("showRulers")} /></div>
        <div className="row"><span className="label" style={{ flex: 1 }}>Guides ({p.guides.length})</span><Switch on={st.showGuides} onChange={() => st.toggle("showGuides")} /></div>
        {p.guides.length > 0 && <button className="btn sm ghost block" onClick={() => p.guides.slice().forEach((g) => st.removeGuide(g.id))}>Clear guides</button>}
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>Drag from a ruler to create a guide. Double‑click a guide to remove it.</div>
      </PropGroup>
      <div className="empty" style={{ padding: "24px 8px" }}>
        <Sparkles size={28} />
        <b>Select an element</b>
        Click any element on the canvas to edit its properties.
      </div>
    </div>
  );
}

/* ---------------- Layers ---------------- */
export function LayersPanel() {
  const st = useEditor();
  const page = st.page()!;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const list = [...page.elements].map((e, i) => ({ e, i })).reverse(); // top first
  const icon = (e: DesignElement) => {
    if (e.type === "image") { const src = st.project!.assets[e.assetId]; return src ? <img src={src} alt="" /> : <ImageIcon size={14} />; }
    if (e.type === "text") return <TypeIcon size={14} />;
    if (e.type === "shape") return <svg viewBox="-4 -4 108 108" width={16} height={16}><path d={shapePath(e.shape, 100, 100, 20)} fill={e.fill.type === "solid" ? e.fill.color : "#e11d2e"} fillRule="evenodd" /></svg>;
    if (e.type === "line") return <Minus size={14} />;
    if (e.type === "icon") { const I = (Lucide as any)[e.icon] ?? Lucide.HelpCircle; return <I size={14} />; }
    return <Box size={14} />;
  };
  const label = (e: DesignElement) => e.type === "text" ? (e.text.split("\n")[0].slice(0, 30) || "Text") : e.name;
  return (
    <div className="right-body" style={{ padding: "8px 8px 32px" }}>
      {!list.length && <div className="empty"><LayersIcon size={32} /><b>No layers yet</b>Add text, shapes or images to get started.</div>}
      {list.map(({ e, i }) => (
        <div key={e.id} draggable={!editing}
          className={"layer" + (st.selection.includes(e.id) ? " active" : "") + (e.hidden ? " dim" : "") + (overIdx === i && dragIdx !== i ? " dragover" : "") + (e.groupId ? " child" : "")}
          onClick={(ev) => st.select([e.id], ev.shiftKey)} onDoubleClick={() => setEditing(e.id)}
          onDragStart={() => setDragIdx(i)} onDragOver={(ev) => { ev.preventDefault(); setOverIdx(i); }} onDragLeave={() => setOverIdx(null)}
          onDrop={() => { if (dragIdx !== null && dragIdx !== i) st.moveLayer(dragIdx, i); setDragIdx(null); setOverIdx(null); }} onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}>
          <GripVertical size={14} color="#c4c7cf" style={{ cursor: "grab", flexShrink: 0 }} />
          <span className="thumb">{icon(e)}</span>
          <span className="name">
            {editing === e.id ? <input autoFocus defaultValue={e.name} onClick={(ev) => ev.stopPropagation()} onBlur={(ev) => { st.updateElement(e.id, { name: ev.target.value || e.name }, false); setEditing(null); }} onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); if (ev.key === "Escape") setEditing(null); }} /> : label(e)}
          </span>
          <span className="acts" onClick={(ev) => ev.stopPropagation()}>
            <button className="ibtn sm" onClick={() => st.toggleLock(e.id)} title={e.locked ? "Unlock" : "Lock"}>{e.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
            <button className="ibtn sm" onClick={() => st.toggleHide(e.id)} title={e.hidden ? "Show" : "Hide"}>{e.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          </span>
        </div>
      ))}
    </div>
  );
}
