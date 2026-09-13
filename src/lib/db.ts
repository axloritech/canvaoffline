import { createStore, get, set, del, keys, getMany } from "idb-keyval";
import type { Project, ProjectMeta } from "./types";

const projectStore = typeof indexedDB !== "undefined" ? createStore("redcanvas-db", "projects") : undefined;
const metaStore = typeof indexedDB !== "undefined" ? createStore("redcanvas-meta", "meta") : undefined;

export async function saveProject(p: Project, thumbnail?: string) {
  if (!projectStore) return;
  await set(p.id, p, projectStore);
  const meta: ProjectMeta = {
    id: p.id, name: p.name, width: p.width, height: p.height, updatedAt: p.updatedAt, pageCount: p.pages.length,
    thumbnail: thumbnail ?? (await get<ProjectMeta>(p.id, metaStore))?.thumbnail,
  };
  await set(p.id, meta, metaStore);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  if (!projectStore) return undefined;
  return get<Project>(id, projectStore);
}

export async function deleteProject(id: string) {
  if (!projectStore) return;
  await del(id, projectStore);
  await del(id, metaStore);
}

export async function listProjects(): Promise<ProjectMeta[]> {
  if (!metaStore) return [];
  const ks = await keys(metaStore);
  const metas = (await getMany<ProjectMeta>(ks as string[], metaStore)).filter(Boolean);
  return metas.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function setSetting<T>(key: string, value: T) {
  if (!metaStore) return;
  await set("__setting_" + key, value, metaStore);
}
export async function getSetting<T>(key: string): Promise<T | undefined> {
  if (!metaStore) return undefined;
  return get<T>("__setting_" + key, metaStore);
}

export async function estimateStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}

export async function requestPersistence() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try { return await navigator.storage.persist(); } catch { return false; }
}
