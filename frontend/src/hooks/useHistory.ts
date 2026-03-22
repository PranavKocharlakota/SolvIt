import { useRef, useCallback } from 'react';

/** Generic undo/redo stack for any serializable state snapshot. */
export function useHistory<T>(initial: T) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const current = useRef<T>(initial);

  const push = useCallback((next: T) => {
    past.current.push(current.current);
    future.current = [];
    current.current = next;
  }, []);

  const undo = useCallback((): T | null => {
    if (past.current.length === 0) return null;
    future.current.push(current.current);
    current.current = past.current.pop()!;
    return current.current;
  }, []);

  const redo = useCallback((): T | null => {
    if (future.current.length === 0) return null;
    past.current.push(current.current);
    current.current = future.current.pop()!;
    return current.current;
  }, []);

  const canUndo = useCallback(() => past.current.length > 0, []);
  const canRedo = useCallback(() => future.current.length > 0, []);

  const getCurrent = useCallback(() => current.current, []);

  return { push, undo, redo, canUndo, canRedo, getCurrent };
}
