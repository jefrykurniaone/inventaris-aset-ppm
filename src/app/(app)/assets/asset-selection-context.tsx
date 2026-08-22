"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Row selection for the asset list (PRD FR-2.6: "row multi-select ... feeds
 * bulk label printing in #12"). Backed by `sessionStorage`, not React state
 * alone: the acceptance criterion is that a selection "survives pagination
 * within a session", and each page of `/assets` is a fresh Server Component
 * render — a full navigation that remounts this provider — so the set of
 * selected ids has to live somewhere that outlives the remount. It is read
 * back on mount rather than trusted to persist across renders.
 */

const STORAGE_KEY = "assets:selection";

function readStoredIds(): readonly string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch (error) {
    console.error("asset-selection-context: failed to read sessionStorage", {
      key: STORAGE_KEY,
      error,
    });
    return [];
  }
}

function writeStoredIds(ids: readonly string[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error("asset-selection-context: failed to write sessionStorage", {
      key: STORAGE_KEY,
      count: ids.length,
      error,
    });
  }
}

interface AssetSelectionValue {
  readonly selectedIds: ReadonlySet<string>;
  readonly toggle: (id: string) => void;
  readonly setMany: (ids: readonly string[], isSelected: boolean) => void;
  readonly clear: () => void;
}

const AssetSelectionContext = createContext<AssetSelectionValue | null>(null);

/** The pure half of `setMany`: apply an add-or-remove of every `targetId` to
 * the current selection. Pulled out of the `useCallback` below so that
 * function's own body — and `usePersistedSelection`'s — stay under the
 * project's 40-line limit. */
function applySelection(
  current: readonly string[],
  targetIds: readonly string[],
  isSelected: boolean,
): readonly string[] {
  const next = new Set(current);
  for (const id of targetIds) {
    if (isSelected) {
      next.add(id);
    } else {
      next.delete(id);
    }
  }
  return [...next];
}

/** `AssetSelectionProvider`'s state, split out so that component's own body
 * is just "call this hook, render the context". */
function usePersistedSelection(): AssetSelectionValue {
  const [ids, setIds] = useState<readonly string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Reads the stored selection once, after mount — `sessionStorage` does not
  // exist during server rendering, and reading it during render rather than
  // in an effect would desynchronise the server- and client-rendered markup.
  useEffect(() => {
    setIds(readStoredIds());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      writeStoredIds(ids);
    }
  }, [ids, isHydrated]);

  const toggle = useCallback((id: string) => {
    setIds((current) =>
      current.includes(id)
        ? current.filter((existing) => existing !== id)
        : [...current, id],
    );
  }, []);

  const setMany = useCallback(
    (targetIds: readonly string[], isSelected: boolean) => {
      setIds((current) => applySelection(current, targetIds, isSelected));
    },
    [],
  );

  const clear = useCallback(() => setIds([]), []);

  return useMemo<AssetSelectionValue>(
    () => ({ selectedIds: new Set(ids), toggle, setMany, clear }),
    [ids, toggle, setMany, clear],
  );
}

export function AssetSelectionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const value = usePersistedSelection();

  return (
    <AssetSelectionContext.Provider value={value}>
      {children}
    </AssetSelectionContext.Provider>
  );
}

export function useAssetSelection(): AssetSelectionValue {
  const context = useContext(AssetSelectionContext);
  if (!context) {
    throw new Error(
      "useAssetSelection: must be called within AssetSelectionProvider",
    );
  }
  return context;
}
