import { useCallback, useEffect, useState } from "react";

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } }

export function usePersisted<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => read(key, initial));
  useEffect(() => write(key, val), [key, val]);
  const set = useCallback((v: T | ((p: T) => T)) => setVal(v), []);
  return [val, set];
}
