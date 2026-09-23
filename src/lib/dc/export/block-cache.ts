const maxEntries = 100;
const maxBytes = 4 * 1024 * 1024;

type CachedBlock = { html: string; bytes: number };

export function createBlockRenderCache() {
  const entries = new Map<string, CachedBlock>();
  const pending = new Map<string, Promise<string>>();
  let bytes = 0;
  let disposed = false;

  async function render(key: string, produce: () => Promise<string>): Promise<string> {
    if (disposed) throw new Error("Export session was disposed.");
    const cached = entries.get(key);
    if (cached) {
      entries.delete(key);
      entries.set(key, cached);
      return cached.html;
    }

    const inFlight = pending.get(key);
    if (inFlight) return inFlight;
    const canStore = key.length * 2 <= maxBytes;
    const result = produce();
    if (canStore && pending.size < maxEntries) pending.set(key, result);

    try {
      const html = await result;
      const size = (key.length + html.length) * 2 + 96;
      if (!disposed && size <= maxBytes) {
        const previous = entries.get(key);
        if (previous) bytes -= previous.bytes;
        entries.delete(key);
        entries.set(key, { html, bytes: size });
        bytes += size;
        while (entries.size > maxEntries || bytes > maxBytes) {
          const oldestKey = entries.keys().next().value;
          if (!oldestKey) break;
          bytes -= entries.get(oldestKey)?.bytes ?? 0;
          entries.delete(oldestKey);
        }
      }
      return html;
    } finally {
      if (pending.get(key) === result) pending.delete(key);
    }
  }

  return {
    render,
    dispose() {
      disposed = true;
      entries.clear();
      pending.clear();
      bytes = 0;
    },
    get usage() {
      return { entries: entries.size, bytes, maxBytes };
    },
  };
}

export type BlockRenderCache = ReturnType<typeof createBlockRenderCache>;
