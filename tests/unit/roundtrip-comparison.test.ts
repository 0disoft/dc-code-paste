import { expect, it } from "vitest";
import {
  compareRoundtrip,
  roundtripPlainSnapshot,
  type RoundtripSnapshot,
} from "#lib/editor/roundtrip-comparison.ts";

function snapshot(texts: string[]): RoundtripSnapshot {
  return {
    mode: "html",
    blocks: texts.map((text, index) => ({ index, text, code: false })),
    links: [],
    lists: [],
    styles: "",
  };
}

it("separates missing, added and changed passages while retaining unchanged anchors", () => {
  const before = snapshot(["제목", "사라진 문장", "그대로 1", "고칠 문장", "그대로 2", "끝"]);
  const after = snapshot(["제목", "그대로 1", "고친 문장", "그대로 2", "끝", "덧붙인 문장"]);
  const comparison = compareRoundtrip(before, after);
  expect(comparison.changes.map((change) => change.kind)).toEqual(["missing", "changed", "added"]);
  expect(comparison.changes[0].before[0].index).toBe(1);
  expect(comparison.changes[1].before[0].text).toBe("고칠 문장");
  expect(comparison.changes[1].after[0].text).toBe("고친 문장");
  expect(comparison.coarse).toBe(false);
  expect(before.blocks).toHaveLength(6);
});

it("detects reordering and duplicate removals rather than comparing unordered sets", () => {
  const before = snapshot(["같은 문장", "첫째", "같은 문장", "둘째"]);
  const after = snapshot(["둘째", "같은 문장", "첫째"]);
  const comparison = compareRoundtrip(before, after);
  expect(comparison.changes.flatMap((change) => change.before.map((block) => block.text))).toEqual([
    "같은 문장",
    "둘째",
  ]);
  expect(comparison.changes.flatMap((change) => change.after.map((block) => block.text))).toEqual([
    "둘째",
  ]);
});

it("distinguishes paragraph grouping from content changes without hiding code indentation", () => {
  expect(compareRoundtrip(snapshot(["하나 둘"]), snapshot(["하나", "둘"])).changes[0].kind).toBe(
    "structure",
  );
  const before = snapshot(["  return value;\n"]);
  const after = snapshot(["return value;\n"]);
  before.blocks[0].code = after.blocks[0].code = true;
  expect(compareRoundtrip(before, after).changes[0].kind).toBe("changed");
});

it("checks link destinations, duplicate link counts, list markers and style information independently", () => {
  const before = snapshot(["같은 글"]);
  before.links = [
    { label: "자료", href: "https://example.com/old" },
    { label: "자료", href: "https://example.com/old" },
  ];
  before.lists = [{ ordered: true, markers: ["1.", "2."], items: ["하나", "둘"] }];
  before.styles = "color:red";
  const after = {
    ...before,
    links: [{ label: "자료", href: "https://example.com/new" }],
    lists: [{ ordered: true, markers: ["2.", "1."], items: ["하나", "둘"] }],
    styles: "",
  };
  expect(compareRoundtrip(before, after)).toMatchObject({
    changes: [],
    linksChanged: true,
    listsChanged: true,
    stylesChanged: true,
  });
  expect(compareRoundtrip(before, before)).toMatchObject({
    changes: [],
    linksChanged: false,
    listsChanged: false,
    stylesChanged: false,
  });
});

it("leaves rich-content checks unknown for plain-only clipboard data", () => {
  const before = snapshot(["같은 글"]);
  before.links = [{ label: "자료", href: "https://example.com/" }];
  expect(compareRoundtrip(before, roundtripPlainSnapshot("같은 글"))).toMatchObject({
    changes: [],
    linksChanged: null,
    listsChanged: null,
    stylesChanged: null,
  });
  expect(roundtripPlainSnapshot("  들여쓰기\r\n\r\n끝").blocks.map((block) => block.text)).toEqual([
    "  들여쓰기",
    "끝",
  ]);
});

it("bounds alignment work while still keeping all unmatched passages", () => {
  const before = snapshot(Array.from({ length: 1200 }, (_, index) => `이전 ${index}`));
  const after = snapshot(Array.from({ length: 1200 }, (_, index) => `이후 ${index}`));
  const comparison = compareRoundtrip(before, after);
  expect(comparison.coarse).toBe(true);
  expect(comparison.changes[0].before).toHaveLength(1200);
  expect(comparison.changes[0].after).toHaveLength(1200);
  expect(() => roundtripPlainSnapshot("글".repeat(200001))).toThrow("20만 자");
  expect(() => roundtripPlainSnapshot("글\n".repeat(4001))).toThrow("구간이 너무 많습니다");
});

it("handles empty sides and long matching prefixes without unnecessary coarse comparisons", () => {
  expect(compareRoundtrip(snapshot([]), snapshot([])).changes).toEqual([]);
  expect(compareRoundtrip(snapshot(["원문"]), snapshot([])).changes[0].kind).toBe("missing");
  expect(compareRoundtrip(snapshot([]), snapshot(["원문"])).changes[0].kind).toBe("added");
  const before = snapshot(Array.from({ length: 3000 }, (_, index) => `${index}`));
  const after = snapshot([...before.blocks.map((block) => block.text), "끝"]);
  expect(compareRoundtrip(before, after)).toMatchObject({
    coarse: false,
    changes: [{ kind: "added" }],
  });
});
