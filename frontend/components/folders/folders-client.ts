"use client";

import { FOLDERS_CHANGED_EVENT, type SavedFolder, type SavedItemInput } from "@/lib/saved-folders";

/** Small fetch helpers for /api/folders; each write tells open views to refresh. */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

function changed() {
  window.dispatchEvent(new Event(FOLDERS_CHANGED_EVENT));
}

export async function listFolders(item?: Pick<SavedItemInput, "type" | "id">): Promise<SavedFolder[]> {
  const query = item ? `?type=${item.type}&id=${encodeURIComponent(item.id)}` : "";
  const { folders } = await request<{ folders: SavedFolder[] }>(`/api/folders${query}`);
  return folders;
}

export async function createFolder(name: string, item?: SavedItemInput): Promise<SavedFolder> {
  const { folder } = await request<{ folder: SavedFolder }>("/api/folders", {
    method: "POST",
    body: JSON.stringify({ name, item }),
  });
  changed();
  return folder;
}

export async function renameFolder(folderId: string, name: string) {
  await request(`/api/folders/${encodeURIComponent(folderId)}`, { method: "PATCH", body: JSON.stringify({ name }) });
  changed();
}

export async function deleteFolder(folderId: string) {
  await request(`/api/folders/${encodeURIComponent(folderId)}`, { method: "DELETE" });
  changed();
}

export async function addToFolder(folderId: string, item: SavedItemInput) {
  await request(`/api/folders/${encodeURIComponent(folderId)}/items`, { method: "POST", body: JSON.stringify(item) });
  changed();
}

export async function removeFromFolder(folderId: string, item: Pick<SavedItemInput, "type" | "id">) {
  await request(
    `/api/folders/${encodeURIComponent(folderId)}/items?type=${item.type}&id=${encodeURIComponent(item.id)}`,
    { method: "DELETE" },
  );
  changed();
}
