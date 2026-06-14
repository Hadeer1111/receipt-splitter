"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoredGroup, StoredSplit } from "./types";
import * as storage from "./storage";

export function useGroups() {
  const [groups, setGroups] = useState<StoredGroup[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    setGroups(storage.getGroups());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    groups,
    loaded,
    refresh,
    save: (group: StoredGroup) => {
      storage.saveGroup(group);
      refresh();
    },
    remove: (id: string) => {
      storage.deleteGroup(id);
      refresh();
    },
  };
}

export function useSplits() {
  const [splits, setSplits] = useState<StoredSplit[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    setSplits(storage.getSplits());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    splits,
    loaded,
    refresh,
    save: (split: StoredSplit) => {
      storage.saveSplit(split);
      refresh();
    },
    remove: (id: string) => {
      storage.deleteSplit(id);
      refresh();
    },
  };
}

export function useSplit(id: string) {
  const [split, setSplit] = useState<StoredSplit | undefined>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSplit(storage.getSplit(id));
    setLoaded(true);
  }, [id]);

  return { split, loaded };
}
