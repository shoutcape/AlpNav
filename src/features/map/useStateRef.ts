import { useCallback, useRef, useState, type RefObject } from "react";

// Keeps a state value and a ref in lockstep so imperative code paths
// (Pixi handlers, draw callbacks) can read the latest value synchronously
// without waiting for React to commit.
export function useStateRef<T>(initial: T): readonly [T, (next: T) => void, RefObject<T>] {
  const [value, setValue] = useState<T>(initial);
  const ref = useRef<T>(initial);
  const set = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
  }, []);
  return [value, set, ref] as const;
}
