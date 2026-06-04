export type DcClipboardPayload = {
  "text/html": Blob;
  "text/plain": Blob;
};

type ClipboardItemConstructor = new (items: {
  "text/html": Blob;
  "text/plain": Blob;
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

export async function copyDcHtml(html: string, plainText: string): Promise<void> {
  const ClipboardItemCtor = getClipboardItemConstructor();

  if (ClipboardItemCtor && typeof navigator !== "undefined" && navigator.clipboard?.write) {
    const item = new ClipboardItemCtor(createDcClipboardPayload(html, plainText));

    await navigator.clipboard.write([item]);
    return;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Clipboard is available only in the browser.");
  }

  const target = document.createElement("div");
  target.setAttribute("contenteditable", "true");
  target.style.position = "fixed";
  target.style.left = "-10000px";
  target.style.top = "0";
  target.innerHTML = html;
  document.body.append(target);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(target);
  selection?.removeAllRanges();
  selection?.addRange(range);

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was rejected.");
    }
  } finally {
    selection?.removeAllRanges();
    target.remove();
  }
}

export async function copyPlainText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
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
  document.body.append(target);
  target.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("Copy command was rejected.");
    }
  } finally {
    target.remove();
  }
}
