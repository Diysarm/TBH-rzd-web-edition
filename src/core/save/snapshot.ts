export function unwrapEs3Entry(entry: unknown): unknown {
  if (entry && typeof entry === "object" && "value" in (entry as Record<string, unknown>)) {
    const value = (entry as Record<string, unknown>).value;
    if (typeof value === "string") {
      const stripped = value.trim();
      if (stripped.startsWith("{") || stripped.startsWith("[")) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
    }
    return value;
  }
  return entry;
}
