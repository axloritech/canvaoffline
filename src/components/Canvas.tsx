"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, Copy, Trash2, Lock, Unlock, ArrowUp, ArrowDown, Check, X as XIcon, Crop, Plus, Minus } from "lucide-react";
import { useEditor, boundsOf } from "@/store/editor";
import type { DesignElement, TextElement, ImageElement } from "@/lib/types";
import { backgroundCss, patternSvgDataUrl, noiseDataUrl, rotatePoint, clamp } from "@/lib/render";
import { ElementContent, elementTransform, textStyle } from "./ElementView";
import { renderPage } from "@/lib/exporter";
import { uid } from "@/lib/defaults";

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
interface DragState {
  kind: "move" | "resize" | "rotate" | "marquee" | "pan" | "guide";
  startX: number; startY: number;
  origin: Map<string, { x: number; y: number; width: number; height: number; rotation: number; fontSize?: number }>;
  handle?: Handle; ids: string[]; moved: boolean;
  pan?: { x: number; y: number }; guideId?: string; guideAxis?: "x" | "y";
  rotCenter?: { x: number; y: number }; startAngle?: number; startRot?: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

const SNAP = 6;

export default function Canvas({ cropId, onCropDone }: { cropId: string | null; onCropDone: () => void }) {
  const st = useEditor();
  const { project, pageIndex, selection, zoom, panX, panY, editingTextId } = st;
  const page = project?.pages[pageIndex];
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [snaps, setSnaps] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [space, setSpace] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; zoom: number; cx: number; cy: number } | null>(null);
  const showRulers = st.showRulers;
  const isTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const rulerOff = showRulers ? 20 : 0;

  // observe size
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setStageSize({ w: el.clientWidth - rulerOff, h: el.clientHeight - rulerOff }));
    ro.observe(el); return () => ro.disconnect();
  }, [rulerOff]);

  // fit on project open / size change
  const fit = useCallback(() => {
    if (!project || !stageSize.w) return;
    const pad = 60;
    const z = Math.min((stageSize.w - pad * 2) / project.width, (stageSize.h - pad * 2 - 90) / project.height, 4);
    st.setZoom(z);
    st.setPan((stageSize.w - project.width * z) / 2, (stageSize.h - 60 - project.height * z) / 2);
  }, [project?.id, project?.width, project?.height, stageSize.w, stageSize.h]); // eslint-disable-line
  useEffect(() => { fit(); }, [fit]);
  useEffect(() => { (window as any).__fitCanvas = fit; }, [fit]);
  const zoomAt = useCallback((z: number) => {
    const s = useEditor.getState(); const cx = stageSize.w / 2, cy = stageSize.h / 2;
    const nz = Math.min(8, Math.max(0.05, z)); const k = nz / s.zoom;
    s.setPan(cx - (cx - s.panX) * k, cy - (cy - s.panY) * k); s.setZoom(nz);
  }, [stageSize.w, stageSize.h]);
  // Pan so the selected element(s) sit inside the visible area above a bottom overlay (mobile edit sheet)
  useEffect(() => {
    (window as any).__ensureVisible = (bottomInset: number) => {
      const s = useEditor.getState(); const pg = s.page(); if (!pg || !stageSize.w) return;
      const els = pg.elements.filter((e) => s.selection.includes(e.id)); if (!els.length) return;
      const x0 = Math.min(...els.map((e) => e.x)), y0 = Math.min(...els.map((e) => e.y)), x1 = Math.max(...els.map((e) => e.x + e.width)), y1 = Math.max(...els.map((e) => e.y + e.height));
      const visH = Math.max(120, stageSize.h - bottomInset), visW = stageSize.w;
      let z = s.zoom; const bw = (x1 - x0) * z, bh = (y1 - y0) * z;
      if (bw > visW * 0.9 || bh > visH * 0.9) { z = Math.min(z, (visW * 0.9) / (x1 - x0), (visH * 0.9) / (y1 - y0)); s.setZoom(z); }
      const cx = ((x0 + x1) / 2) * z, cy = ((y0 + y1) / 2) * z;
      s.setPan(visW / 2 - cx, visH / 2 - cy);
    };
  }, [stageSize.w, stageSize.h]);

  // space key for panning
  useEffect(() => {
    const d = (e: KeyboardEvent) => { if (e.code === "Space" && !(e.target as HTMLElement).isContentEditable && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "TEXTAREA") { setSpace(true); e.preventDefault(); } };
    const u = (e: KeyboardEvent) => { if (e.code === "Space") setSpace(false); };
    window.addEventListener("keydown", d); window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, []);

  const toCanvas = useCallback((cx: number, cy: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: (cx - r.left - rulerOff - panX) / zoom, y: (cy - r.top - rulerOff - panY) / zoom };
  }, [panX, panY, zoom, rulerOff]);

  // wheel: zoom with ctrl/meta, pan otherwise
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useEditor.getState();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - r.left - rulerOff, my = e.clientY - r.top - rulerOff;
        const nz = clamp(s.zoom * Math.exp(-e.deltaY * 0.0015), 0.05, 8);
        const k = nz / s.zoom;
        s.setZoom(nz); s.setPan(mx - (mx - s.panX) * k, my - (my - s.panY) * k);
      } else s.setPan(s.panX - e.deltaX, s.panY - e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [rulerOff]);

  if (!project || !page) return <div className="stage" ref={stageRef} />;
  const W = project.width, H = project.height;
  const els = page.elements;
  const byId = (id: string) => els.find((e) => e.id === id);
  const selEls = selection.map(byId).filter(Boolean) as DesignElement[];
  const expandIds = (ids: string[]) => { const out = new Set<string>(); ids.forEach((id) => { const e = byId(id); if (!e) return; out.add(id); if (e.type === "group") e.children.forEach((c) => out.add(c)); }); return [...out]; };

  /* ---------- snapping ---------- */
  const snapTargets = (excl: Set<string>) => {
    const v = [0, W / 2, W], h = [0, H / 2, H];
    if (st.snapToObjects) els.forEach((e) => { if (excl.has(e.id) || e.hidden || e.type === "group") return; v.push(e.x, e.x + e.width / 2, e.x + e.width); h.push(e.y, e.y + e.height / 2, e.y + e.height); });
    if (st.showGuides) project.guides.forEach((g) => (g.axis === "x" ? v : h).push(g.pos));
    return { v, h };
  };
  const applySnap = (b: { x: number; y: number; width: number; height: number }, excl: Set<string>) => {
    const t = snapTargets(excl); const tol = SNAP / zoom;
    let dx = 0, dy = 0, sv: number[] = [], sh: number[] = [];
    const xs = [b.x, b.x + b.width / 2, b.x + b.width], ys = [b.y, b.y + b.height / 2, b.y + b.height];
    let best = tol;
    xs.forEach((x) => t.v.forEach((tv) => { const d = Math.abs(tv - x); if (d < best) { best = d; dx = tv - x; sv = [tv]; } }));
    best = tol;
    ys.forEach((y) => t.h.forEach((th) => { const d = Math.abs(th - y); if (d < best) { best = d; dy = th - y; sh = [th]; } }));
    if (st.snapToGrid) { const g = st.gridSize; if (!sv.length) dx = Math.round(b.x / g) * g - b.x; if (!sh.length) dy = Math.round(b.y / g) * g - b.y; }
    return { dx, dy, sv, sh };
  };

  /* ---------- pointer handlers ---------- */
  const beginDrag = (e: React.PointerEvent, d: DragState) => {
    drag.current = d;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const lastDown = useRef<{ id: string; t: number }>({ id: "", t: 0 });
  const onElementDown = (e: React.PointerEvent, el: DesignElement) => {
    if (cropId) return;
    if (space || e.button === 1) return;
    e.stopPropagation();
    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size >= 2) { beginPinch(); return; }
    }
    if (editingTextId === el.id) return;
    // manual double-click/tap detection (pointer capture retargets native dblclick)
    const now = Date.now();
    if (lastDown.current.id === el.id && now - lastDown.current.t < 350 && !el.locked) {
      lastDown.current = { id: "", t: 0 };
      e.preventDefault(); // stop the compat mousedown from stealing focus from the editor
      if (el.type === "text") { st.select([el.id]); st.setEditingText(el.id); return; }
      if (el.type === "image") { (window as any).__startCrop?.(el.id); return; }
    }
    lastDown.current = { id: el.id, t: now };
    if (editingTextId) st.setEditingText(null);
    const targetId = el.groupId ?? el.id;
    let ids = selection;
    if (e.shiftKey) { st.select([el.id], true); ids = selection.includes(targetId) ? selection.filter((i) => i !== targetId) : [...selection, targetId]; }
    else if (!selection.includes(targetId)) { st.select([el.id]); ids = [targetId]; }
    const movable = expandIds(ids).filter((id) => !byId(id)?.locked);
    if (!movable.length) return;
    const p = toCanvas(e.clientX, e.clientY);
    const origin = new Map(); movable.forEach((id) => { const x = byId(id)!; origin.set(id, { x: x.x, y: x.y, width: x.width, height: x.height, rotation: x.rotation }); });
    drag.current = { kind: "move", startX: p.x, startY: p.y, origin, ids: movable, moved: false, bounds: boundsOf(movable.map(byId) as DesignElement[]) };
    stageRef.current!.setPointerCapture(e.pointerId);
  };

  const onHandleDown = (e: React.PointerEvent, handle: Handle) => {
    e.stopPropagation();
    const ids = expandIds(selection).filter((id) => !byId(id)?.locked);
    const p = toCanvas(e.clientX, e.clientY);
    const origin = new Map(); ids.forEach((id) => { const x = byId(id)!; origin.set(id, { x: x.x, y: x.y, width: x.width, height: x.height, rotation: x.rotation, fontSize: x.type === "text" ? x.fontSize : undefined }); });
    drag.current = { kind: "resize", handle, startX: p.x, startY: p.y, origin, ids, moved: false, bounds: boundsOf(selection.map(byId) as DesignElement[]) };
    stageRef.current!.setPointerCapture(e.pointerId);
  };

  const onRotateDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const ids = expandIds(selection).filter((id) => !byId(id)?.locked);
    const b = boundsOf(selection.map(byId) as DesignElement[]);
    const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const p = toCanvas(e.clientX, e.clientY);
    const origin = new Map(); ids.forEach((id) => { const x = byId(id)!; origin.set(id, { x: x.x, y: x.y, width: x.width, height: x.height, rotation: x.rotation }); });
    drag.current = { kind: "rotate", startX: p.x, startY: p.y, origin, ids, moved: false, rotCenter: c, startAngle: Math.atan2(p.y - c.y, p.x - c.x), startRot: selEls[0]?.rotation ?? 0 };
    stageRef.current!.setPointerCapture(e.pointerId);
  };

  const onStageDown = (e: React.PointerEvent) => {
    if (cropId) return;
    if ((e.target as HTMLElement).closest(".float-bar, .ctx-bar, .pages-bar, .storage-note")) return;
    if (st.eyedropper) { sampleColor(e.clientX, e.clientY); return; }
    if (space || e.button === 1 || (e.pointerType === "touch" && (e as any).isPrimary === false)) {
      drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, origin: new Map(), ids: [], moved: false, pan: { x: panX, y: panY } };
      stageRef.current!.setPointerCapture(e.pointerId); return;
    }
    if (editingTextId) st.setEditingText(null);
    if (!e.shiftKey) st.clearSelection();
    if (e.pointerType === "touch") {
      // On touch: no selection rectangle; dragging on empty space pans the view
      drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, origin: new Map(), ids: [], moved: false, pan: { x: panX, y: panY } };
      stageRef.current!.setPointerCapture(e.pointerId); return;
    }
    const p = toCanvas(e.clientX, e.clientY);
    drag.current = { kind: "marquee", startX: p.x, startY: p.y, origin: new Map(), ids: [], moved: false };
    stageRef.current!.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    if (d.kind === "pan") { st.setPan(d.pan!.x + e.clientX - d.startX, d.pan!.y + e.clientY - d.startY); return; }
    const p = toCanvas(e.clientX, e.clientY);
    const dx0 = p.x - d.startX, dy0 = p.y - d.startY;
    if (!d.moved && Math.hypot(dx0, dy0) * zoom < 3) return;
    if (!d.moved) { d.moved = true; if (d.kind !== "marquee" && d.kind !== "guide") st.commit(); }

    if (d.kind === "guide") { st.updateGuide(d.guideId!, d.guideAxis === "x" ? p.x : p.y); return; }
    if (d.kind === "marquee") { setMarquee({ x: Math.min(p.x, d.startX), y: Math.min(p.y, d.startY), w: Math.abs(dx0), h: Math.abs(dy0) }); return; }

    if (d.kind === "move") {
      let dx = dx0, dy = dy0;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const b = d.bounds!;
      const s = applySnap({ x: b.x + dx, y: b.y + dy, width: b.width, height: b.height }, new Set(d.ids));
      dx += s.dx; dy += s.dy; setSnaps({ v: s.sv, h: s.sh });
      st.updateElements(d.ids, (el) => { const o = d.origin.get(el.id)!; return { x: o.x + dx, y: o.y + dy }; }, false);
      return;
    }
    if (d.kind === "rotate") {
      const c = d.rotCenter!;
      let ang = ((Math.atan2(p.y - c.y, p.x - c.x) - d.startAngle!) * 180) / Math.PI;
      let rot = d.startRot! + ang;
      if (e.shiftKey) rot = Math.round(rot / 15) * 15;
      const delta = rot - d.startRot!;
      st.updateElements(d.ids, (el) => {
        const o = d.origin.get(el.id)!;
        if (d.ids.length === 1) return { rotation: ((rot % 360) + 360) % 360 };
        const ec = rotatePoint(o.x + o.width / 2, o.y + o.height / 2, c.x, c.y, delta);
        return { rotation: o.rotation + delta, x: ec.x - o.width / 2, y: ec.y - o.height / 2 };
      }, false);
      return;
    }
    if (d.kind === "resize") {
      const h = d.handle!, b = d.bounds!;
      const single = d.ids.length === 1 ? byId(d.ids[0]) : null;
      const rot = single ? single.rotation : 0;
      // transform delta into element local space
      const r = (-rot * Math.PI) / 180;
      let ldx = dx0 * Math.cos(r) - dy0 * Math.sin(r), ldy = dx0 * Math.sin(r) + dy0 * Math.cos(r);
      const keepRatio = e.shiftKey || (single && (single.type === "image" || single.type === "icon" || (single.type === "text" && h.length === 2))) || d.ids.length > 1;
      let nx = b.x, ny = b.y, nw = b.width, nh = b.height;
      if (h.includes("e")) nw = b.width + ldx;
      if (h.includes("w")) { nw = b.width - ldx; nx = b.x + ldx; }
      if (h.includes("s")) nh = b.height + ldy;
      if (h.includes("n")) { nh = b.height - ldy; ny = b.y + ldy; }
      if (keepRatio && h.length === 2) {
        const ratio = b.width / b.height;
        if (Math.abs(nw / b.width) > Math.abs(nh / b.height)) nh = nw / ratio; else nw = nh * ratio;
        if (h.includes("w")) nx = b.x + b.width - nw;
        if (h.includes("n")) ny = b.y + b.height - nh;
      }
      nw = Math.max(4, nw); nh = Math.max(4, nh);
      // for rotated singles, keep the opposite anchor fixed
      if (single && rot) {
        const ax = h.includes("w") ? 1 : h.includes("e") ? 0 : 0.5, ay = h.includes("n") ? 1 : h.includes("s") ? 0 : 0.5;
        const oc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        const anchor = rotatePoint(b.x + ax * b.width, b.y + ay * b.height, oc.x, oc.y, rot);
        const ncLocal = { x: nx + nw / 2, y: ny + nh / 2 };
        const anchorLocal = { x: nx + ax * nw, y: ny + ay * nh };
        const v = { x: ncLocal.x - anchorLocal.x, y: ncLocal.y - anchorLocal.y };
        const rv = rotatePoint(v.x, v.y, 0, 0, rot);
        const nc = { x: anchor.x + rv.x, y: anchor.y + rv.y };
        nx = nc.x - nw / 2; ny = nc.y - nh / 2;
      }
      const sx = nw / b.width, sy = nh / b.height;
      st.updateElements(d.ids, (el) => {
        const o = d.origin.get(el.id)!;
        const patch: any = { x: nx + (o.x - b.x) * sx, y: ny + (o.y - b.y) * sy, width: o.width * sx, height: o.height * sy };
        if (el.type === "text") {
          if (h.length === 2 || d.ids.length > 1) patch.fontSize = Math.max(4, (o.fontSize ?? el.fontSize) * Math.min(sx, sy));
          else if (h === "e" || h === "w") { patch.autoWidth = false; patch.height = o.height; }
          else { patch.height = o.height; }
        }
        if (el.type === "line") patch.height = o.height;
        return patch;
      }, false);
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; setSnaps({ v: [], h: [] });
    if (!d) return;
    if (d.kind === "marquee") {
      if (marquee) {
        const ids = els.filter((el) => !el.hidden && !el.locked && el.type !== "group" && el.x < marquee.x + marquee.w && el.x + el.width > marquee.x && el.y < marquee.y + marquee.h && el.y + el.height > marquee.y).map((el) => el.groupId ?? el.id);
        st.select([...new Set(ids)], e.shiftKey);
      }
      setMarquee(null);
    }
    if (d.kind === "guide") {
      const r = stageRef.current!.getBoundingClientRect();
      const g = project.guides.find((x) => x.id === d.guideId);
      if (g && (e.clientX < r.left + rulerOff || e.clientY < r.top + rulerOff)) st.removeGuide(g.id);
    }
    if (d.moved && d.kind !== "pan") st.save();
    // measure text auto height after resize
    if (d.kind === "resize" && d.moved) requestAnimationFrame(syncTextHeights);
  };

  const syncTextHeights = () => {
    const s = useEditor.getState(); const pg = s.page(); if (!pg) return;
    pg.elements.forEach((el) => {
      if (el.type !== "text") return;
      const node = document.querySelector(`[data-elid="${el.id}"] .el-text`) as HTMLElement | null;
      if (!node) return;
      const h = node.scrollHeight; const w = node.scrollWidth;
      const patch: any = {};
      if (Math.abs(h - el.height) > 1) patch.height = h;
      if (el.autoWidth && Math.abs(w - el.width) > 1) patch.width = w;
      if (Object.keys(patch).length) s.updateElement(el.id, patch, false);
    });
  };
  useEffect(() => { const t = requestAnimationFrame(syncTextHeights); return () => cancelAnimationFrame(t); }); // eslint-disable-line

  /* ---------- touch pinch ---------- */
  const beginPinch = () => {
    const [a, b] = [...touches.current.values()];
    const s = useEditor.getState();
    // If a one-finger drag already started (moved an element), revert it so pinch never leaves stray moves
    const d = drag.current;
    if (d && d.kind !== "pan" && d.moved && d.origin.size) {
      s.updateElements(d.ids, (el) => { const o = d.origin.get(el.id)!; return { x: o.x, y: o.y, width: o.width, height: o.height, rotation: o.rotation }; }, false);
      s.undo(); // drop the history entry pushed when the drag began
    }
    pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: s.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    drag.current = { kind: "pan", startX: pinch.current.cx, startY: pinch.current.cy, origin: new Map(), ids: [], moved: false, pan: { x: s.panX, y: s.panY } };
    setMarquee(null); setSnaps({ v: [], h: [] });
  };
  const onPD = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size >= 2) { beginPinch(); return; }
    }
    onStageDown(e);
  };
  const onPM = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2 && pinch.current) {
        const [a, b] = [...touches.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const nz = clamp(pinch.current.zoom * (dist / pinch.current.d), 0.05, 8);
        const r = stageRef.current!.getBoundingClientRect();
        const mx = pinch.current.cx - r.left - rulerOff, my = pinch.current.cy - r.top - rulerOff;
        const k = nz / pinch.current.zoom;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        st.setZoom(nz);
        st.setPan(mx - (mx - drag.current!.pan!.x) * k + (cx - pinch.current.cx), my - (my - drag.current!.pan!.y) * k + (cy - pinch.current.cy));
        return;
      }
    }
    onMove(e);
  };
  const onPU = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") { touches.current.delete(e.pointerId); if (touches.current.size < 2) pinch.current = null; if (drag.current?.kind === "pan" && touches.current.size) return; }
    onUp(e);
  };

  /* ---------- eyedropper ---------- */
  const sampleColor = async (cx: number, cy: number) => {
    const fn = st.eyedropper; if (!fn) return;
    const p = toCanvas(cx, cy);
    const scale = Math.min(1, 800 / W);
    const c = await renderPage(project, page, scale);
    const d = c.getContext("2d")!.getImageData(clamp(p.x * scale, 0, c.width - 1), clamp(p.y * scale, 0, c.height - 1), 1, 1).data;
    const hex = "#" + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, "0")).join("");
    fn(hex); st.setEyedropper(null);
  };

  /* ---------- guides from rulers ---------- */
  const onRulerDown = (axis: "x" | "y", e: React.PointerEvent) => {
    const p = toCanvas(e.clientX, e.clientY);
    const g = { id: uid(), axis, pos: axis === "x" ? p.x : p.y };
    st.addGuide(g);
    drag.current = { kind: "guide", startX: p.x, startY: p.y, origin: new Map(), ids: [], moved: true, guideId: g.id, guideAxis: axis };
    stageRef.current!.setPointerCapture(e.pointerId);
  };
  const onGuideDown = (id: string, axis: "x" | "y", e: React.PointerEvent) => {
    e.stopPropagation();
    const p = toCanvas(e.clientX, e.clientY);
    drag.current = { kind: "guide", startX: p.x, startY: p.y, origin: new Map(), ids: [], moved: true, guideId: id, guideAxis: axis };
    stageRef.current!.setPointerCapture(e.pointerId);
  };

  /* ---------- text editing ---------- */
  const onTextInput = (el: TextElement, node: HTMLElement) => {
    st.updateElement(el.id, { text: node.innerText.replace(/\n$/, ""), height: node.scrollHeight, ...(el.autoWidth ? { width: node.scrollWidth } : {}) }, false);
  };

  /* ---------- render ---------- */
  const bg = page.background;
  const pattern = bg.pattern !== "none" ? patternSvgDataUrl(bg.pattern, bg.patternColor, bg.patternOpacity) : null;
  const selBounds = selEls.length ? boundsOf(selEls) : null;
  const single = selEls.length === 1 ? selEls[0] : null;
  const anyLocked = selEls.some((e) => e.locked);
  const ctxTop = selBounds ? panY + selBounds.y * zoom - 52 : 0;
  const ctxLeft = selBounds ? panX + (selBounds.x + selBounds.width / 2) * zoom : 0;

  const renderEl = (el: DesignElement) => {
    if (el.type === "group") return null;
    const g = el.groupId ? byId(el.groupId) : undefined;
    if (g?.hidden) return null;
    const editing = editingTextId === el.id;
    return (
      <div key={el.id} data-elid={el.id} className={"el" + (el.hidden ? " hidden" : "")}
        style={{ left: el.x, top: el.y, width: el.width, height: el.height, transform: elementTransform(el), opacity: el.opacity * (g?.opacity ?? 1), cursor: el.locked ? "default" : editing ? "text" : "move", pointerEvents: cropId ? "none" : "auto" }}
        onPointerDown={(e) => onElementDown(e, el)}
        onPointerEnter={() => setHoverId(el.id)} onPointerLeave={() => setHoverId(null)}
>
        {editing && el.type === "text"
          ? <TextEditor el={el} onInput={(n) => onTextInput(el, n)} onDone={() => { st.setEditingText(null); st.commit(); st.save(); }} />
          : <ElementContent el={el} assets={project.assets} />}
      </div>
    );
  };

  const hs = 12 / zoom;
  const cursorFor = (h: Handle) => { const map: Record<Handle, string> = { n: "ns", s: "ns", e: "ew", w: "ew", ne: "nesw", sw: "nesw", nw: "nwse", se: "nwse" }; return map[h] + "-resize"; };
  const handleOpts: Handle[] = single?.type === "line" ? ["e", "w"] : single?.type === "text" ? ["e", "w", "ne", "nw", "se", "sw"] : ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

  return (
    <div ref={stageRef} className={"stage" + (showRulers ? " with-rulers" : "")} style={{ cursor: st.eyedropper ? "crosshair" : space ? "grab" : undefined }}
      onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU}>
      {showRulers && <>
        <div className="ruler-corner" />
        <Ruler axis="x" zoom={zoom} pan={panX} size={stageSize.w} onDown={(e) => onRulerDown("y", e)} />
        <Ruler axis="y" zoom={zoom} pan={panY} size={stageSize.h} onDown={(e) => onRulerDown("x", e)} />
      </>}
      <div className={"viewport" + (showRulers ? " rulers" : "")}>
        <div className="artboard" style={{ left: panX, top: panY, width: W, height: H, transform: `scale(${zoom})` }}>
          <div className="artboard-clip checker">
            <div style={{ position: "absolute", inset: 0, ...backgroundCss(bg, project.assets) }} />
            {pattern && <div style={{ position: "absolute", inset: 0, backgroundImage: pattern }} />}
            {bg.noise > 0 && <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${noiseDataUrl()})`, opacity: bg.noise / 100, mixBlendMode: "overlay" }} />}
            {st.showGrid && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundSize: `${st.gridSize}px ${st.gridSize}px`, backgroundImage: "linear-gradient(to right, rgba(0,0,0,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.08) 1px, transparent 1px)" }} />}
            {els.map(renderEl)}
          </div>
          {/* overlays in canvas space */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {hoverId && !selection.includes(byId(hoverId)?.groupId ?? hoverId) && !cropId && (() => { const h = byId(hoverId)!; const t = h.groupId ? byId(h.groupId)! : h; return <div className="sel-box hover" style={{ left: t.x, top: t.y, width: t.width, height: t.height, transform: `rotate(${t.rotation}deg)`, borderWidth: 1 / zoom }} />; })()}
            {selEls.length > 1 && selBounds && <div className="sel-box multi" style={{ left: selBounds.x, top: selBounds.y, width: selBounds.width, height: selBounds.height, borderWidth: 1 / zoom }} />}
            {selEls.map((e) => <div key={e.id} className="sel-box" style={{ left: e.x, top: e.y, width: e.width, height: e.height, transform: `rotate(${e.rotation}deg)`, borderWidth: 1.5 / zoom }} />)}
            {selBounds && !editingTextId && !anyLocked && !cropId && (() => {
              const b = single ?? selBounds; const rot = single ? single.rotation : 0;
              return (
                <div style={{ position: "absolute", left: b.x, top: b.y, width: b.width, height: b.height, transform: `rotate(${rot}deg)` }}>
                  {handleOpts.map((h) => {
                    const l = h.includes("w") ? 0 : h.includes("e") ? b.width : b.width / 2, t = h.includes("n") ? 0 : h.includes("s") ? b.height : b.height / 2;
                    const edge = h.length === 1; const horiz = h === "n" || h === "s";
                    return <div key={h} className={"handle" + (edge ? (horiz ? " edge-h" : " edge-v") : "")}
                      style={{ left: l, top: t, transform: `translate(-50%,-50%) scale(${1 / zoom})`, cursor: cursorFor(h), width: edge ? (horiz ? 22 : 8) : 12, height: edge ? (horiz ? 8 : 22) : 12 }}
                      onPointerDown={(e) => onHandleDown(e, h)} />;
                  })}
                  <div className="handle rot" style={{ left: b.width / 2, top: b.height + 28 / zoom, transform: `translate(-50%,-50%) scale(${1 / zoom})` }} onPointerDown={onRotateDown}><RotateCw size={12} /></div>
                </div>
              );
            })()}
            {snaps.v.map((x, i) => <div key={"v" + i} className="snapline v" style={{ left: x, width: 1 / zoom }} />)}
            {snaps.h.map((y, i) => <div key={"h" + i} className="snapline h" style={{ top: y, height: 1 / zoom }} />)}
            {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, borderWidth: 1 / zoom }} />}
          </div>
          {st.showGuides && project.guides.map((g) => (
            <div key={g.id} className={"guide " + (g.axis === "x" ? "v" : "h")} style={g.axis === "x" ? { left: g.pos - 3 / zoom, padding: `0 ${3 / zoom}px`, width: 7 / zoom, top: -4000, bottom: -4000 } : { top: g.pos - 3 / zoom, padding: `${3 / zoom}px 0`, height: 7 / zoom, left: -4000, right: -4000 }}
              onPointerDown={(e) => onGuideDown(g.id, g.axis, e)} onDoubleClick={() => st.removeGuide(g.id)} />
          ))}
          {cropId && byId(cropId)?.type === "image" && <CropOverlay el={byId(cropId) as ImageElement} zoom={zoom} onDone={onCropDone} />}
        </div>
        {/* zoom slider – lives at the edge, design stays visible while dragging */}
        {!cropId && <ZoomSlider zoom={zoom} onChange={(z) => zoomAt(z)} />}
        {/* context bar */}
        {selBounds && !editingTextId && !cropId && (
          <div className={"ctx-bar" + (isTouch ? " docked" : "")} style={isTouch ? undefined : { left: clamp(ctxLeft, 120, Math.max(120, stageSize.w - 120)), top: clamp(ctxTop, 8, stageSize.h - 60), transform: "translateX(-50%)" }} onPointerDown={(e) => e.stopPropagation()}>
            {single?.type === "image" && <button className="ibtn sm" title="Crop" onClick={() => (window as any).__startCrop?.(single.id)}><Crop size={15} /></button>}
            <button className="ibtn sm" title="Duplicate (Ctrl+D)" onClick={st.duplicateSelected}><Copy size={15} /></button>
            {single && <button className="ibtn sm" title="Bring forward" onClick={() => st.reorder(single.id, "up")}><ArrowUp size={15} /></button>}
            {single && <button className="ibtn sm" title="Send backward" onClick={() => st.reorder(single.id, "down")}><ArrowDown size={15} /></button>}
            {single && <button className="ibtn sm" title={single.locked ? "Unlock" : "Lock"} onClick={() => st.toggleLock(single.id)}>{single.locked ? <Lock size={15} /> : <Unlock size={15} />}</button>}
            <button className="ibtn sm danger" title="Delete" onClick={st.deleteSelected}><Trash2 size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function TextEditor({ el, onInput, onDone }: { el: TextElement; onInput: (n: HTMLElement) => void; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // uncontrolled: set initial text once, then let the browser own the DOM while typing
  useEffect(() => {
    const n = ref.current; if (!n) return;
    n.innerText = el.text;
    n.focus();
    const r = document.createRange(); r.selectNodeContents(n);
    const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
  }, []); // eslint-disable-line
  const style = useMemo(() => ({ ...textStyle(el), minWidth: 20 }), [el.fontFamily, el.fontSize, el.fontWeight, el.italic, el.underline, el.uppercase, el.align, el.lineHeight, el.letterSpacing, el.fill, el.stroke, el.shadow, el.glow, el.autoWidth]); // eslint-disable-line
  return (
    <div ref={ref} className="el-text editing" contentEditable suppressContentEditableWarning style={style}
      onInput={(e) => onInput(e.currentTarget)} onBlur={onDone}
      onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); (e.target as HTMLElement).blur(); } e.stopPropagation(); }}
      onPointerDown={(e) => e.stopPropagation()} />
  );
}

function Ruler({ axis, zoom, pan, size, onDown }: { axis: "x" | "y"; zoom: number; pan: number; size: number; onDown: (e: React.PointerEvent) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c || !size) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = (axis === "x" ? size : 20) * dpr; c.height = (axis === "x" ? 20 : size) * dpr;
    const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#9ca3af"; ctx.font = "9px Inter, sans-serif"; ctx.strokeStyle = "#d1d5db";
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    const step = steps.find((s) => s * zoom >= 50) ?? 5000;
    const start = Math.floor(-pan / zoom / step) * step;
    ctx.beginPath();
    for (let v = start; v * zoom + pan < size; v += step) {
      const px = v * zoom + pan;
      if (axis === "x") { ctx.moveTo(px + 0.5, 20); ctx.lineTo(px + 0.5, 10); ctx.fillText(String(v), px + 3, 9); for (let k = 1; k < 5; k++) { const m = px + (step * zoom * k) / 5; ctx.moveTo(m + 0.5, 20); ctx.lineTo(m + 0.5, 16); } }
      else { ctx.moveTo(20, px + 0.5); ctx.lineTo(10, px + 0.5); ctx.save(); ctx.translate(9, px + 3); ctx.rotate(-Math.PI / 2); ctx.textAlign = "right"; ctx.fillText(String(v), 0, 0); ctx.restore(); for (let k = 1; k < 5; k++) { const m = px + (step * zoom * k) / 5; ctx.moveTo(20, m + 0.5); ctx.lineTo(16, m + 0.5); } }
    }
    ctx.stroke();
  }, [axis, zoom, pan, size]);
  return <canvas ref={ref} className={"ruler " + (axis === "x" ? "top" : "left")} style={axis === "x" ? { width: size, height: 20 } : { width: 20, height: size }} onPointerDown={onDown} />;
}

/* ---------- Crop overlay ---------- */
function CropOverlay({ el, zoom, onDone }: { el: ImageElement; zoom: number; onDone: () => void }) {
  const st = useEditor();
  // full image box in canvas coords given current crop
  const fullW = el.width / el.crop.w, fullH = el.height / el.crop.h;
  const fullX = el.x - el.crop.x * fullW, fullY = el.y - el.crop.y * fullH;
  const [box, setBox] = useState({ x: el.x, y: el.y, w: el.width, h: el.height });
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ kind: string; sx: number; sy: number; b: typeof box } | null>(null);

  const down = (kind: string) => (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    dragRef.current = { kind, sx: e.clientX, sy: e.clientY, b: box };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    const dx = (e.clientX - d.sx) / zoom, dy = (e.clientY - d.sy) / zoom;
    let { x, y, w, h } = d.b;
    if (d.kind === "move") { x = clamp(x + dx, fullX, fullX + fullW - w); y = clamp(y + dy, fullY, fullY + fullH - h); }
    else {
      if (d.kind.includes("e")) w = clamp(w + dx, 10, fullX + fullW - x);
      if (d.kind.includes("s")) h = clamp(h + dy, 10, fullY + fullH - y);
      if (d.kind.includes("w")) { const nx = clamp(x + dx, fullX, x + w - 10); w += x - nx; x = nx; }
      if (d.kind.includes("n")) { const ny = clamp(y + dy, fullY, y + h - 10); h += y - ny; y = ny; }
    }
    setBox({ x, y, w, h });
  };
  const up = () => { dragRef.current = null; };
  const apply = () => {
    st.commit();
    st.updateElement(el.id, { x: box.x, y: box.y, width: box.w, height: box.h, crop: { x: (box.x - fullX) / fullW, y: (box.y - fullY) / fullH, w: box.w / fullW, h: box.h / fullH } }, false);
    st.save(); onDone();
  };
  const reset = () => { setBox({ x: fullX, y: fullY, w: fullW, h: fullH }); };
  const hs = 16 / zoom;
  return (
    <div ref={ref} className="crop-overlay" style={{ left: -4000, top: -4000, right: -4000, bottom: -4000, position: "absolute" }} onPointerDown={(e) => e.stopPropagation()} onPointerMove={move} onPointerUp={up}>
      <div style={{ position: "absolute", left: 4000 + fullX, top: 4000 + fullY, width: fullW, height: fullH, opacity: 0.4, transform: `rotate(${el.rotation}deg)` }}>
        <img src={st.project!.assets[el.assetId]} alt="" style={{ width: "100%", height: "100%", display: "block" }} draggable={false} />
      </div>
      <div style={{ position: "absolute", left: 4000 + box.x, top: 4000 + box.y, width: box.w, height: box.h, overflow: "hidden", transform: `rotate(${el.rotation}deg)` }}>
        <img src={st.project!.assets[el.assetId]} alt="" style={{ position: "absolute", left: fullX - box.x, top: fullY - box.y, width: fullW, height: fullH, display: "block" }} draggable={false} />
      </div>
      <div className="crop-box" style={{ left: 4000 + box.x, top: 4000 + box.y, width: box.w, height: box.h, borderWidth: 2 / zoom }} onPointerDown={down("move")}>
        {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as const).map((k) => (
          <div key={k} className="crop-h" onPointerDown={down(k)} style={{ width: hs, height: hs, left: k.includes("w") ? -hs / 2 : k.includes("e") ? `calc(100% - ${hs / 2}px)` : `calc(50% - ${hs / 2}px)`, top: k.includes("n") ? -hs / 2 : k.includes("s") ? `calc(100% - ${hs / 2}px)` : `calc(50% - ${hs / 2}px)`, cursor: `${k}-resize` }} />
        ))}
      </div>
      <div className="ctx-bar" style={{ left: 4000 + box.x + box.w / 2, top: 4000 + box.y - 48 / zoom, transform: `translateX(-50%) scale(${1 / zoom})`, transformOrigin: "center bottom" }}>
        <button className="btn sm ghost" onClick={reset}>Reset</button>
        <button className="btn sm ghost" onClick={onDone}><XIcon size={14} /> Cancel</button>
        <button className="btn sm primary" onClick={apply}><Check size={14} /> Apply</button>
      </div>
    </div>
  );
}


/* Vertical zoom slider docked to the stage edge. Log scale 5% – 800%. */
function ZoomSlider({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  const min = Math.log(0.05), max = Math.log(8);
  const v = (Math.log(zoom) - min) / (max - min);
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const set = (clientY: number) => { const r = ref.current!.getBoundingClientRect(); const t = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height)); onChange(Math.exp(min + t * (max - min))); };
  return (
    <div className={"zoom-slider" + (active ? " active" : "")} onPointerDown={(e) => e.stopPropagation()}>
      <button className="ibtn sm" onClick={() => onChange(zoom * 1.2)} title="Zoom in"><Plus size={14} /></button>
      <div ref={ref} className="track" onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setActive(true); document.dispatchEvent(new CustomEvent("rc-peek", { detail: true })); set(e.clientY); }}
        onPointerMove={(e) => { if (active) set(e.clientY); }}
        onPointerUp={() => { setActive(false); document.dispatchEvent(new CustomEvent("rc-peek", { detail: false })); }}
        onPointerCancel={() => { setActive(false); document.dispatchEvent(new CustomEvent("rc-peek", { detail: false })); }}>
        <div className="fill" style={{ height: `${v * 100}%` }} />
        <div className="knob" style={{ bottom: `calc(${v * 100}% - 9px)` }} />
      </div>
      <button className="ibtn sm" onClick={() => onChange(zoom / 1.2)} title="Zoom out"><Minus size={14} /></button>
      <span className="pct" onClick={() => (window as any).__fitCanvas?.()} title="Fit to screen">{Math.round(zoom * 100)}%</span>
    </div>
  );
}
