"use client";
import { create } from "zustand";
import type { DesignElement, Page, Project, Background, Guide, GroupElement } from "@/lib/types";
import { newPage, uid, newProject } from "@/lib/defaults";
import { saveProject } from "@/lib/db";

export type Tool = "select" | "text" | "elements" | "images" | "shapes" | "background" | "effects" | "layers" | "projects" | "pages";

interface Clipboard { elements: DesignElement[]; assets: Record<string, string> }

interface EditorState {
  project: Project | null;
  pageIndex: number;
  selection: string[];
  tool: Tool;
  zoom: number;
  panX: number; panY: number;
  showGrid: boolean; snapToGrid: boolean; gridSize: number; showRulers: boolean; showGuides: boolean; snapToObjects: boolean;
  editingTextId: string | null;
  recentColors: string[];
  past: Project[]; future: Project[];
  dirty: boolean; lastSavedAt: number | null;
  clipboard: Clipboard | null;
  panelOpen: boolean; rightTab: "props" | "layers";
  fullscreen: boolean;
  eyedropper: ((hex: string) => void) | null;

  // project lifecycle
  setProject: (p: Project | null) => void;
  createProject: (name: string, w: number, h: number) => Project;
  renameProject: (name: string) => void;
  resizeProject: (w: number, h: number, scaleContent: boolean) => void;
  save: (thumbnail?: string) => Promise<void>;

  // page
  page: () => Page | null;
  setPageIndex: (i: number) => void;
  addPage: () => void;
  duplicatePage: (i: number) => void;
  deletePage: (i: number) => void;
  movePage: (from: number, to: number) => void;
  renamePage: (i: number, name: string) => void;
  setBackground: (patch: Partial<Background>) => void;

  // elements
  addElement: (el: DesignElement, select?: boolean) => void;
  addAsset: (dataUrl: string) => string;
  updateElement: (id: string, patch: Partial<DesignElement>, history?: boolean) => void;
  updateElements: (ids: string[], fn: (el: DesignElement) => Partial<DesignElement>, history?: boolean) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copy: () => void;
  paste: () => void;
  select: (ids: string[], additive?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  reorder: (id: string, dir: "up" | "down" | "top" | "bottom") => void;
  moveLayer: (from: number, to: number) => void;
  toggleLock: (id: string) => void;
  toggleHide: (id: string) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  alignSelected: (how: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom" | "hdist" | "vdist") => void;
  nudge: (dx: number, dy: number) => void;
  setEditingText: (id: string | null) => void;

  // history
  commit: () => void;
  undo: () => void;
  redo: () => void;

  // view
  setTool: (t: Tool) => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  toggle: (k: "showGrid" | "snapToGrid" | "showRulers" | "showGuides" | "snapToObjects" | "panelOpen" | "fullscreen") => void;
  setRightTab: (t: "props" | "layers") => void;
  addRecentColor: (c: string) => void;
  addGuide: (g: Guide) => void;
  updateGuide: (id: string, pos: number) => void;
  removeGuide: (id: string) => void;
  setEyedropper: (fn: ((hex: string) => void) | null) => void;
}

const MAX_HISTORY = 80;
const clone = <T,>(o: T): T => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useEditor = create<EditorState>((set, get) => {
  const touch = (p: Project) => { p.updatedAt = Date.now(); return p; };
  const pushHistory = () => {
    const { project, past } = get();
    if (!project) return;
    const snap = clone(project);
    set({ past: [...past.slice(-MAX_HISTORY + 1), snap], future: [], dirty: true });
    scheduleSave();
  };
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => get().save(), 1200);
  };
  const mutate = (fn: (p: Project) => void, history = true) => {
    const { project } = get();
    if (!project) return;
    if (history) pushHistory();
    const p = clone(project);
    fn(p);
    touch(p);
    set({ project: p, dirty: true });
    scheduleSave();
  };
  const curPage = (p: Project) => p.pages[get().pageIndex] ?? p.pages[0];

  return {
    project: null, pageIndex: 0, selection: [], tool: "select", zoom: 1, panX: 0, panY: 0,
    showGrid: false, snapToGrid: false, gridSize: 20, showRulers: true, showGuides: true, snapToObjects: true,
    editingTextId: null, recentColors: [], past: [], future: [], dirty: false, lastSavedAt: null, clipboard: null,
    panelOpen: true, rightTab: "props", fullscreen: false, eyedropper: null,

    setProject: (p) => set({ project: p, pageIndex: 0, selection: [], past: [], future: [], dirty: false, zoom: 1, panX: 0, panY: 0, editingTextId: null }),
    createProject: (name, w, h) => { const p = newProject(name, w, h); get().setProject(p); saveProject(p); return p; },
    renameProject: (name) => mutate((p) => { p.name = name; }, false),
    resizeProject: (w, h, scaleContent) => mutate((p) => {
      const sx = w / p.width, sy = h / p.height;
      if (scaleContent) {
        const s = Math.min(sx, sy);
        p.pages.forEach((pg) => pg.elements.forEach((el) => {
          el.x *= sx; el.y *= sy; el.width *= s; el.height *= s;
          if (el.type === "text") el.fontSize *= s;
        }));
      }
      p.width = w; p.height = h;
    }),
    save: async (thumbnail) => {
      const { project } = get();
      if (!project) return;
      try { await saveProject(project, thumbnail); set({ dirty: false, lastSavedAt: Date.now() }); } catch (e) { console.error(e); }
    },

    page: () => { const p = get().project; return p ? curPage(p) : null; },
    setPageIndex: (i) => set({ pageIndex: i, selection: [], editingTextId: null }),
    addPage: () => { mutate((p) => { p.pages.push(newPage(`Page ${p.pages.length + 1}`)); }); set({ pageIndex: get().project!.pages.length - 1, selection: [] }); },
    duplicatePage: (i) => { mutate((p) => { const c = clone(p.pages[i]); c.id = uid(); c.name += " copy"; c.elements.forEach((e) => (e.id = uid())); p.pages.splice(i + 1, 0, c); }); set({ pageIndex: i + 1, selection: [] }); },
    deletePage: (i) => { const p = get().project; if (!p || p.pages.length <= 1) return; mutate((pr) => { pr.pages.splice(i, 1); }); set({ pageIndex: Math.max(0, Math.min(i, get().project!.pages.length - 1)), selection: [] }); },
    movePage: (from, to) => { mutate((p) => { const [pg] = p.pages.splice(from, 1); p.pages.splice(to, 0, pg); }); set({ pageIndex: to }); },
    renamePage: (i, name) => mutate((p) => { p.pages[i].name = name; }, false),
    setBackground: (patch) => mutate((p) => { Object.assign(curPage(p).background, patch); }),

    addElement: (el, select = true) => {
      mutate((p) => { curPage(p).elements.push(el); });
      if (select) set({ selection: [el.id], rightTab: "props" });
    },
    addAsset: (dataUrl) => { const id = uid(); mutate((p) => { p.assets[id] = dataUrl; }, false); return id; },
    updateElement: (id, patch, history = true) => mutate((p) => {
      const el = curPage(p).elements.find((e) => e.id === id);
      if (el) Object.assign(el, patch);
    }, history),
    updateElements: (ids, fn, history = true) => mutate((p) => {
      curPage(p).elements.forEach((el) => { if (ids.includes(el.id)) Object.assign(el, fn(el)); });
    }, history),
    deleteSelected: () => {
      const sel = get().selection; if (!sel.length) return;
      mutate((p) => {
        const pg = curPage(p);
        const toDelete = new Set(sel);
        pg.elements.forEach((e) => { if (e.type === "group" && sel.includes(e.id)) e.children.forEach((c) => toDelete.add(c)); });
        pg.elements = pg.elements.filter((e) => !toDelete.has(e.id) && !e.locked || (e.locked && !toDelete.has(e.id)));
      });
      set({ selection: [], editingTextId: null });
    },
    duplicateSelected: () => {
      const sel = get().selection; if (!sel.length) return;
      const newIds: string[] = [];
      mutate((p) => {
        const pg = curPage(p);
        const map = new Map<string, string>();
        const copies: DesignElement[] = [];
        const ids = new Set(sel);
        pg.elements.forEach((e) => { if (e.type === "group" && ids.has(e.id)) e.children.forEach((c) => ids.add(c)); });
        pg.elements.forEach((e) => {
          if (!ids.has(e.id)) return;
          const c = clone(e); c.id = uid(); c.x += 24; c.y += 24; map.set(e.id, c.id); copies.push(c);
        });
        copies.forEach((c) => { if (c.type === "group") c.children = c.children.map((ch) => map.get(ch) ?? ch); if (c.groupId) c.groupId = map.get(c.groupId); if (sel.includes([...map.entries()].find(([, v]) => v === c.id)?.[0] ?? "")) newIds.push(c.id); });
        pg.elements.push(...copies);
      });
      set({ selection: newIds });
    },
    copy: () => {
      const { selection, project } = get(); if (!project || !selection.length) return;
      const pg = curPage(project);
      const ids = new Set(selection);
      pg.elements.forEach((e) => { if (e.type === "group" && ids.has(e.id)) e.children.forEach((c) => ids.add(c)); });
      const els = pg.elements.filter((e) => ids.has(e.id)).map(clone);
      const assets: Record<string, string> = {};
      els.forEach((e) => { if (e.type === "image" && project.assets[e.assetId]) assets[e.assetId] = project.assets[e.assetId]; });
      set({ clipboard: { elements: els, assets } });
    },
    paste: () => {
      const { clipboard, selection } = get(); if (!clipboard) return;
      const newIds: string[] = [];
      mutate((p) => {
        Object.assign(p.assets, clipboard.assets);
        const map = new Map<string, string>();
        const copies = clipboard.elements.map((e) => { const c = clone(e); c.id = uid(); c.x += 24; c.y += 24; map.set(e.id, c.id); return c; });
        copies.forEach((c) => { if (c.type === "group") c.children = c.children.map((ch) => map.get(ch) ?? ch); if (c.groupId) c.groupId = map.get(c.groupId); if (!c.groupId) newIds.push(c.id); });
        curPage(p).elements.push(...copies);
      });
      // shift clipboard so repeated pastes cascade
      set({ selection: newIds, clipboard: { ...clipboard, elements: clipboard.elements.map((e) => ({ ...e, x: e.x + 24, y: e.y + 24 })) } });
      void selection;
    },
    select: (ids, additive) => {
      const p = get().project; if (!p) { set({ selection: ids }); return; }
      const pg = curPage(p);
      // if element belongs to a group, select the group instead
      const resolved = ids.map((id) => { const el = pg.elements.find((e) => e.id === id); return el?.groupId ?? id; });
      if (additive) {
        const cur = new Set(get().selection);
        resolved.forEach((id) => (cur.has(id) ? cur.delete(id) : cur.add(id)));
        set({ selection: [...cur] });
      } else set({ selection: resolved });
      if (ids.length) set({ rightTab: "props" });
    },
    selectAll: () => { const pg = get().page(); if (pg) set({ selection: pg.elements.filter((e) => !e.locked && !e.hidden && !e.groupId).map((e) => e.id) }); },
    clearSelection: () => set({ selection: [], editingTextId: null }),
    reorder: (id, dir) => mutate((p) => {
      const els = curPage(p).elements;
      const i = els.findIndex((e) => e.id === id); if (i < 0) return;
      const [el] = els.splice(i, 1);
      const to = dir === "up" ? Math.min(els.length, i + 1) : dir === "down" ? Math.max(0, i - 1) : dir === "top" ? els.length : 0;
      els.splice(to, 0, el);
    }),
    moveLayer: (from, to) => mutate((p) => { const els = curPage(p).elements; const [el] = els.splice(from, 1); els.splice(to, 0, el); }),
    toggleLock: (id) => mutate((p) => { const el = curPage(p).elements.find((e) => e.id === id); if (el) el.locked = !el.locked; }),
    toggleHide: (id) => mutate((p) => { const el = curPage(p).elements.find((e) => e.id === id); if (el) el.hidden = !el.hidden; }),
    groupSelected: () => {
      const sel = get().selection; if (sel.length < 2) return;
      const gid = uid();
      mutate((p) => {
        const pg = curPage(p);
        const members = pg.elements.filter((e) => sel.includes(e.id));
        const bounds = boundsOf(members);
        const g: GroupElement = {
          id: gid, type: "group", name: "Group", ...bounds, rotation: 0, opacity: 1, locked: false, hidden: false, flipX: false, flipY: false,
          shadow: { enabled: false, x: 4, y: 4, blur: 10, color: "#000", opacity: 0.5 }, glow: { enabled: false, blur: 20, color: "#e11d2e", opacity: 0.8 },
          children: members.map((m) => m.id),
        };
        members.forEach((m) => (m.groupId = gid));
        // insert group above the topmost member
        const maxIdx = Math.max(...members.map((m) => pg.elements.indexOf(m)));
        pg.elements.splice(maxIdx + 1, 0, g);
      });
      set({ selection: [gid] });
    },
    ungroupSelected: () => {
      const sel = get().selection;
      const ids: string[] = [];
      mutate((p) => {
        const pg = curPage(p);
        sel.forEach((id) => {
          const g = pg.elements.find((e) => e.id === id);
          if (g?.type !== "group") return;
          g.children.forEach((c) => { const el = pg.elements.find((e) => e.id === c); if (el) { delete el.groupId; ids.push(el.id); } });
          pg.elements.splice(pg.elements.indexOf(g), 1);
        });
      });
      if (ids.length) set({ selection: ids });
    },
    alignSelected: (how) => {
      const { selection, project } = get(); if (!project || !selection.length) return;
      const W = project.width, H = project.height;
      mutate((p) => {
        const pg = curPage(p);
        const els = pg.elements.filter((e) => selection.includes(e.id));
        const ref = els.length > 1 ? boundsOf(els) : { x: 0, y: 0, width: W, height: H };
        const moveEl = (e: DesignElement, dx: number, dy: number) => {
          e.x += dx; e.y += dy;
          if (e.type === "group") e.children.forEach((c) => { const ch = pg.elements.find((x) => x.id === c); if (ch) { ch.x += dx; ch.y += dy; } });
        };
        if (how === "hdist" || how === "vdist") {
          if (els.length < 3) return;
          const k = how === "hdist" ? "x" : "y", s = how === "hdist" ? "width" : "height";
          const sorted = [...els].sort((a, b) => a[k] - b[k]);
          const total = sorted.reduce((acc, e) => acc + e[s], 0);
          const span = (sorted[sorted.length - 1][k] + sorted[sorted.length - 1][s]) - sorted[0][k];
          const gap = (span - total) / (sorted.length - 1);
          let cur = sorted[0][k];
          sorted.forEach((e) => { const d = cur - e[k]; moveEl(e, how === "hdist" ? d : 0, how === "vdist" ? d : 0); cur += e[s] + gap; });
          return;
        }
        els.forEach((e) => {
          let dx = 0, dy = 0;
          if (how === "left") dx = ref.x - e.x;
          if (how === "hcenter") dx = ref.x + ref.width / 2 - (e.x + e.width / 2);
          if (how === "right") dx = ref.x + ref.width - (e.x + e.width);
          if (how === "top") dy = ref.y - e.y;
          if (how === "vcenter") dy = ref.y + ref.height / 2 - (e.y + e.height / 2);
          if (how === "bottom") dy = ref.y + ref.height - (e.y + e.height);
          moveEl(e, dx, dy);
        });
      });
    },
    nudge: (dx, dy) => {
      const sel = get().selection; if (!sel.length) return;
      mutate((p) => {
        const pg = curPage(p);
        pg.elements.forEach((e) => {
          if (!sel.includes(e.id) || e.locked) return;
          e.x += dx; e.y += dy;
          if (e.type === "group") e.children.forEach((c) => { const ch = pg.elements.find((x) => x.id === c); if (ch) { ch.x += dx; ch.y += dy; } });
        });
      });
    },
    setEditingText: (id) => set({ editingTextId: id }),

    commit: () => pushHistory(),
    undo: () => {
      const { past, project, future } = get();
      if (!past.length || !project) return;
      const prev = past[past.length - 1];
      set({ project: prev, past: past.slice(0, -1), future: [clone(project), ...future].slice(0, MAX_HISTORY), dirty: true, pageIndex: Math.min(get().pageIndex, prev.pages.length - 1), editingTextId: null });
      set({ selection: get().selection.filter((id) => get().page()?.elements.some((e) => e.id === id)) });
      scheduleSave();
    },
    redo: () => {
      const { future, project, past } = get();
      if (!future.length || !project) return;
      const next = future[0];
      set({ project: next, future: future.slice(1), past: [...past, clone(project)], dirty: true, pageIndex: Math.min(get().pageIndex, next.pages.length - 1), editingTextId: null });
      set({ selection: get().selection.filter((id) => get().page()?.elements.some((e) => e.id === id)) });
      scheduleSave();
    },

    setTool: (t) => set({ tool: t, panelOpen: true }),
    setZoom: (z) => set({ zoom: Math.min(8, Math.max(0.05, z)) }),
    setPan: (x, y) => set({ panX: x, panY: y }),
    toggle: (k) => set({ [k]: !get()[k] } as any),
    setRightTab: (t) => set({ rightTab: t }),
    addRecentColor: (c) => { const r = [c, ...get().recentColors.filter((x) => x !== c)].slice(0, 12); set({ recentColors: r }); },
    addGuide: (g) => mutate((p) => { p.guides.push(g); }, false),
    updateGuide: (id, pos) => mutate((p) => { const g = p.guides.find((x) => x.id === id); if (g) g.pos = pos; }, false),
    removeGuide: (id) => mutate((p) => { p.guides = p.guides.filter((g) => g.id !== id); }, false),
    setEyedropper: (fn) => set({ eyedropper: fn }),
  };
});

export function boundsOf(els: DesignElement[]) {
  if (!els.length) return { x: 0, y: 0, width: 0, height: 0 };
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  els.forEach((e) => { x1 = Math.min(x1, e.x); y1 = Math.min(y1, e.y); x2 = Math.max(x2, e.x + e.width); y2 = Math.max(y2, e.y + e.height); });
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
