import { isPaletteBlockKind, type PaletteBlockKind } from "./block-inspector.ts";

const paletteMime = "application/x-dc-block";
let activeKind: PaletteBlockKind | undefined;
type DragData = Pick<DataTransfer, "types" | "getData">;

export function startPaletteDrag(
  transfer: Pick<DataTransfer, "setData" | "effectAllowed">,
  kind: PaletteBlockKind,
) {
  transfer.setData(paletteMime, kind);
  // Supply a standard flavor too; WebKit can replace custom drag data entirely.
  transfer.setData("text/plain", `dc-code-paste:block:${kind}`);
  transfer.effectAllowed = "copy";
  activeKind = kind;
}

export function endPaletteDrag() {
  activeKind = undefined;
}

export function carriesPaletteBlock(transfer: DragData | null) {
  if (!transfer) return false;
  const types = Array.from(transfer.types);
  return types.includes(paletteMime) || Boolean(activeKind && types.includes("text/plain"));
}

export function readPaletteDragKind(transfer: DragData | null): PaletteBlockKind | undefined {
  if (!transfer) return;
  const custom = transfer.getData(paletteMime);
  if (custom) return isPaletteBlockKind(custom) ? custom : undefined;
  // The palette's own dragstart is the source of truth when native drag data
  // has been replaced. External text cannot choose a block kind, and dragend
  // clears this transient state even when a drag is canceled.
  return activeKind;
}
