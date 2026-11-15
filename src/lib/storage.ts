/** Reads a JSON value from localStorage. Returns null if it is missing, invalid or unavailable. */
export function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Writes a JSON value to localStorage. Silently does nothing if storage is unavailable. */
export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full quota: the app carries on without persistence.
  }
}
