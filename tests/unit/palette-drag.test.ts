import { beforeEach, afterEach, expect, it } from "vitest";
import { paletteBlockKinds } from "#lib/editor/block-inspector.ts";
import {
  startPaletteDrag,
  endPaletteDrag,
  carriesPaletteBlock,
  readPaletteDragKind,
} from "#lib/editor/palette-drag.ts";

function transfer() {
  const data = new Map<string, string>();
  return {
    data,
    effectAllowed: "none" as DataTransfer["effectAllowed"],
    get types() {
      return [...data.keys()];
    },
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
    },
  };
}
beforeEach(endPaletteDrag);
afterEach(endPaletteDrag);

it("retains custom MIME data and copies every supported palette block", () => {
  for (const kind of paletteBlockKinds) {
    const data = transfer();
    startPaletteDrag(data, kind);
    expect(data.effectAllowed).toBe("copy");
    expect(carriesPaletteBlock(data)).toBe(true);
    expect(readPaletteDragKind(data)).toBe(kind);
    data.data.delete("application/x-dc-block");
    expect(readPaletteDragKind(data)).toBe(kind);
    endPaletteDrag();
  }
});

it("recognizes protected text-only dragovers and reads their data at drop time", () => {
  const data = transfer();
  startPaletteDrag(data, "summary");
  data.data.delete("application/x-dc-block");
  const protectedData = { types: data.types, getData: () => "" };
  expect(carriesPaletteBlock(protectedData)).toBe(true);
  expect(readPaletteDragKind(protectedData)).toBe("summary");
  expect(readPaletteDragKind(data)).toBe("summary");
});

it("ignores external text as a block kind and clears canceled palette drags", () => {
  const data = transfer();
  data.setData("text/plain", "dc-code-paste:block:summary");
  expect(carriesPaletteBlock(data)).toBe(false);
  expect(readPaletteDragKind(data)).toBeUndefined();
  const source = transfer();
  startPaletteDrag(source, "code");
  expect(readPaletteDragKind(data)).toBe("code");
  data.setData("application/x-dc-block", "unknown-block");
  expect(readPaletteDragKind(data)).toBeUndefined();
  source.data.delete("application/x-dc-block");
  endPaletteDrag();
  expect(carriesPaletteBlock(source)).toBe(false);
  expect(readPaletteDragKind(source)).toBeUndefined();
  expect(readPaletteDragKind(null)).toBeUndefined();
  expect(carriesPaletteBlock(null)).toBe(false);
});
