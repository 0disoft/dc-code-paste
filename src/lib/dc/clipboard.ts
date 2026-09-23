export type DcClipboardPayload = {
  "text/html": Blob;
  "text/plain": Blob;
};

type ClipboardItemConstructor = new (items: {
  "text/html": Blob | Promise<Blob>;
  "text/plain": Blob | Promise<Blob>;
}) => ClipboardItem;

export function createDcClipboardPayload(html: string, plainText: string): DcClipboardPayload {
  return {
    "text/html": new Blob([html], { type: "text/html" }),
    "text/plain": new Blob([plainText], { type: "text/plain" }),
  };
}

function getClipboardItemConstructor(): ClipboardItemConstructor | undefined {
  if (typeof ClipboardItem !== "undefined") {
    return ClipboardItem as ClipboardItemConstructor;
  }

  return undefined;
}

function preserveBrowserSelection() {
  const activeElement = document.activeElement as HTMLElement | null;
  const selection = window.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const input = activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  const inputSelection =
    input &&
    typeof input.selectionStart === "number" &&
    typeof input.setSelectionRange === "function"
      ? {
          start: input.selectionStart,
          end: input.selectionEnd ?? input.selectionStart,
          direction: input.selectionDirection,
        }
      : undefined;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return () => {
    if (activeElement?.isConnected) {
      activeElement.focus({ preventScroll: true });
      if (inputSelection) {
        input?.setSelectionRange(
          inputSelection.start,
          inputSelection.end,
          inputSelection.direction ?? "none",
        );
      }
    }
    selection?.removeAllRanges();
    for (const range of ranges) selection?.addRange(range);
    if (typeof window.scrollTo === "function") window.scrollTo(scrollX, scrollY);
  };
}

async function copyDcHtmlFallback(html: string, plainText: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Clipboard is available only in the browser.");
  }

  const target = document.createElement("div");
  target.setAttribute("contenteditable", "true");
  target.style.position = "fixed";
  target.style.left = "-10000px";
  target.style.top = "0";
  const restore = preserveBrowserSelection();
  const onCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    event.clipboardData.setData("text/html", html);
    event.clipboardData.setData("text/plain", plainText);
    event.preventDefault();
  };
  try {
    target.innerHTML = html;
    document.body.append(target);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.addEventListener("copy", onCopy);
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was rejected.");
    }
  } finally {
    document.removeEventListener("copy", onCopy);
    target.remove();
    restore();
  }
}

export async function copyDcHtml(html: string, plainText: string): Promise<void> {
  const ClipboardItemCtor = getClipboardItemConstructor();

  if (ClipboardItemCtor && typeof navigator !== "undefined" && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItemCtor(createDcClipboardPayload(html, plainText));
      await navigator.clipboard.write([item]);
      return;
    } catch {
      // An exposed async API can still reject; try the browser fallback.
    }
  }

  await copyDcHtmlFallback(html, plainText);
}

export async function copyDcHtmlWhenReady(
  htmlPromise: Promise<string>,
  plainText: string,
): Promise<void> {
  const ClipboardItemCtor = getClipboardItemConstructor();
  if (ClipboardItemCtor && typeof navigator !== "undefined" && navigator.clipboard?.write) {
    const htmlBlobPromise = htmlPromise.then((html) => new Blob([html], { type: "text/html" }));
    void htmlBlobPromise.catch(() => undefined);
    try {
      const item = new ClipboardItemCtor({
        "text/html": htmlBlobPromise,
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      await htmlPromise;
      return;
    } catch {
      // A rejected async write may still have a synchronous fallback.
    }
  }

  await copyDcHtmlFallback(await htmlPromise, plainText);
}

export async function copyPlainText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // The fallback may also be denied; its failure must still reach the caller.
    }
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Clipboard is available only in the browser.");
  }

  const target = document.createElement("textarea");
  target.value = text;
  target.setAttribute("readonly", "true");
  target.style.position = "fixed";
  target.style.left = "-10000px";
  target.style.top = "0";
  const restore = preserveBrowserSelection();
  try {
    document.body.append(target);
    target.select();
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was rejected.");
    }
  } finally {
    target.remove();
    restore();
  }
}
