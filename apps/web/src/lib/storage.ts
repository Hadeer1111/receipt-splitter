import type { StoredGroup, StoredSplit } from "./types";

const GROUPS_KEY = "receipt-splitter:groups";
const SPLITS_KEY = "receipt-splitter:splits";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getGroups(): StoredGroup[] {
  return readJson<StoredGroup[]>(GROUPS_KEY, []);
}

export function saveGroup(group: StoredGroup): void {
  const groups = getGroups();
  const index = groups.findIndex((g) => g.id === group.id);
  if (index >= 0) groups[index] = group;
  else groups.unshift(group);
  writeJson(GROUPS_KEY, groups);
}

export function deleteGroup(id: string): void {
  writeJson(
    GROUPS_KEY,
    getGroups().filter((g) => g.id !== id),
  );
}

export function getSplits(): StoredSplit[] {
  return readJson<StoredSplit[]>(SPLITS_KEY, []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getSplit(id: string): StoredSplit | undefined {
  return getSplits().find((s) => s.id === id);
}

export function saveSplit(split: StoredSplit): void {
  const splits = readJson<StoredSplit[]>(SPLITS_KEY, []);
  const index = splits.findIndex((s) => s.id === split.id);
  if (index >= 0) splits[index] = split;
  else splits.unshift(split);
  writeJson(SPLITS_KEY, splits);
}

export function deleteSplit(id: string): void {
  writeJson(
    SPLITS_KEY,
    readJson<StoredSplit[]>(SPLITS_KEY, []).filter((s) => s.id !== id),
  );
}
