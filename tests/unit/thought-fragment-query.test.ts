import { expect, it } from "vitest";
import type { ThoughtFragmentEntry } from "#lib/editor/thought-fragments.ts";
import {
  queryThoughtFragments,
  thoughtFragmentNeedsReview,
} from "#lib/editor/thought-fragment-query.ts";

function entry(
  text: string,
  state?: "linked" | "changed" | "missing" | "duplicated",
  sourceChanged = false,
): ThoughtFragmentEntry {
  const use = {
    id: "use",
    kind: "prose" as const,
    parts: [{ id: "part", text: "넣을 당시 문장" }],
  };
  return {
    fragment: { id: text, text, createdAt: "2026-10-09T00:00:00.000Z", uses: state ? [use] : [] },
    uses: state
      ? [
          {
            use,
            state,
            sourceChanged,
            parts: [
              {
                reference: use.parts[0],
                matches:
                  state === "missing"
                    ? []
                    : [
                        {
                          id: "part",
                          from: 1,
                          to: 10,
                          text: "지금 본문에서 고친 문장",
                          code: false,
                        },
                      ],
              },
            ],
          },
        ]
      : [],
  };
}

it("finds stored material with Unicode, case and whitespace normalization without changing it", () => {
  const fragments = [entry("한글\n  ＣＯＤＥ"), entry("별도 내용")];
  expect(queryThoughtFragments(fragments, "  한글 code  ", "all")).toEqual([fragments[0]]);
  expect(queryThoughtFragments(fragments, "한글".normalize("NFD"), "all")).toEqual([fragments[0]]);
  expect(fragments[0].fragment.text).toBe("한글\n  ＣＯＤＥ");
  expect(queryThoughtFragments(fragments, "찾을 수 없음", "all")).toEqual([]);
});

it("finds current inserted passages and snapshots whose original passage is gone", () => {
  const fragments = [entry("수정된 조각", "changed"), entry("사라진 조각", "missing")];
  expect(queryThoughtFragments(fragments, "본문에서 고친", "all")).toEqual([fragments[0]]);
  expect(queryThoughtFragments(fragments, "넣을 당시 문장", "all")).toEqual(fragments);
});

it("separates unused material from changed, missing, duplicated and source-edited insertions", () => {
  const unused = entry("아직 안 넣음");
  const linked = entry("그대로 있음", "linked");
  const changed = entry("수정됨", "changed");
  const missing = entry("없어짐", "missing");
  const duplicated = entry("여러 곳", "duplicated");
  const sourceChanged = entry("보관한 내용 수정", "linked", true);
  const fragments = [unused, linked, changed, missing, duplicated, sourceChanged];
  expect(queryThoughtFragments(fragments, "", "unused")).toEqual([unused]);
  expect(queryThoughtFragments(fragments, "", "review")).toEqual([
    changed,
    missing,
    duplicated,
    sourceChanged,
  ]);
  expect(queryThoughtFragments(fragments, "내용", "review")).toEqual([sourceChanged]);
  expect(thoughtFragmentNeedsReview(unused)).toBe(false);
  expect(thoughtFragmentNeedsReview(linked)).toBe(false);
  expect(queryThoughtFragments(fragments, " \n ", "all")).toEqual(fragments);
});
