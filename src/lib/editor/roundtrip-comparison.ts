export type RoundtripRange = { path: number[]; start: number; end: number };
export type RoundtripBlock = {
  index: number;
  text: string;
  code: boolean;
  range?: RoundtripRange;
};
export type RoundtripLink = { label: string; href: string };
export type RoundtripList = { ordered: boolean; markers: string[]; items: string[] };
export type RoundtripSnapshot = {
  mode: "html" | "plain";
  blocks: RoundtripBlock[];
  links: RoundtripLink[];
  lists: RoundtripList[];
  styles: string;
};
export type RoundtripChange = {
  kind: "changed" | "missing" | "added" | "structure";
  before: RoundtripBlock[];
  after: RoundtripBlock[];
};
export type RoundtripComparison = {
  before: RoundtripSnapshot;
  after: RoundtripSnapshot;
  changes: RoundtripChange[];
  linksChanged: boolean | null;
  listsChanged: boolean | null;
  stylesChanged: boolean | null;
  coarse: boolean;
};

function key(block: RoundtripBlock) {
  return `${block.code ? "code" : "text"}:${block.text}`;
}

function sameWords(blocks: RoundtripBlock[]) {
  return blocks
    .map((block) => block.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Align unchanged passages first, with a bounded matrix for long pasted articles. */
export function compareRoundtrip(
  before: RoundtripSnapshot,
  after: RoundtripSnapshot,
): RoundtripComparison {
  let start = 0;
  while (
    start < before.blocks.length &&
    start < after.blocks.length &&
    key(before.blocks[start]) === key(after.blocks[start])
  )
    start++;
  let beforeEnd = before.blocks.length;
  let afterEnd = after.blocks.length;
  while (
    beforeEnd > start &&
    afterEnd > start &&
    key(before.blocks[beforeEnd - 1]) === key(after.blocks[afterEnd - 1])
  ) {
    beforeEnd--;
    afterEnd--;
  }
  const first = before.blocks.slice(start, beforeEnd);
  const second = after.blocks.slice(start, afterEnd);
  const coarse = (first.length + 1) * (second.length + 1) > 1_000_000;
  const changes: RoundtripChange[] = [];
  let removed: RoundtripBlock[] = [];
  let added: RoundtripBlock[] = [];
  function flush() {
    if (!removed.length && !added.length) return;
    const sameCode =
      JSON.stringify(removed.filter((block) => block.code).map((block) => block.text)) ===
      JSON.stringify(added.filter((block) => block.code).map((block) => block.text));
    changes.push({
      kind: !removed.length
        ? "added"
        : !added.length
          ? "missing"
          : sameCode && sameWords(removed) === sameWords(added)
            ? "structure"
            : "changed",
      before: removed,
      after: added,
    });
    removed = [];
    added = [];
  }
  if (coarse) {
    removed = first;
    added = second;
  } else {
    const width = second.length + 1;
    const matrix = new Uint16Array((first.length + 1) * width);
    for (let left = first.length - 1; left >= 0; left--) {
      for (let right = second.length - 1; right >= 0; right--) {
        matrix[left * width + right] =
          key(first[left]) === key(second[right])
            ? matrix[(left + 1) * width + right + 1] + 1
            : Math.max(matrix[(left + 1) * width + right], matrix[left * width + right + 1]);
      }
    }
    let left = 0;
    let right = 0;
    while (left < first.length || right < second.length) {
      if (left < first.length && right < second.length && key(first[left]) === key(second[right])) {
        flush();
        left++;
        right++;
      } else if (
        left < first.length &&
        (right === second.length ||
          matrix[(left + 1) * width + right] >= matrix[left * width + right + 1])
      ) {
        removed.push(first[left++]);
      } else added.push(second[right++]);
    }
  }
  flush();
  const rich = after.mode === "html";
  return {
    before,
    after,
    changes,
    coarse,
    linksChanged: rich ? JSON.stringify(before.links) !== JSON.stringify(after.links) : null,
    listsChanged: rich ? JSON.stringify(before.lists) !== JSON.stringify(after.lists) : null,
    stylesChanged: rich ? before.styles !== after.styles : null,
  };
}

export function roundtripPlainSnapshot(text: string): RoundtripSnapshot {
  if (text.length > 200_000)
    throw new Error("비교할 본문이 너무 깁니다. 20만 자 이하로 가져와 주세요.");
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .filter((line) => line.trim());
  if (lines.length > 4000)
    throw new Error("비교할 구간이 너무 많습니다. 더 작은 구간으로 가져와 주세요.");
  return {
    mode: "plain",
    blocks: lines.map((text, index) => ({ index, text, code: false })),
    links: [],
    lists: [],
    styles: "",
  };
}
