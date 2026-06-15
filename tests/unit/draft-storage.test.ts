import { describe, expect, it } from "vitest";
import { sampleDocument } from "../../src/lib/editor/sample-document";
import {
  appendDraftHistorySnapshot,
  clearDraftHistorySnapshots,
  clearDraftSnapshot,
  createDraftHistorySnapshot,
  createDraftSnapshot,
  deleteDraftHistorySnapshot,
  draftHistoryStorageKey,
  draftStorageKey,
  maxDraftHistoryCount,
  parseDraftHistorySnapshots,
  parseDraftSnapshot,
  readDraftHistorySnapshots,
  readDraftSnapshot,
  renameDraftHistorySnapshot,
  writeDraftHistorySnapshots,
  writeDraftSnapshot,
  type DraftPreferences,
} from "../../src/lib/editor/draft-storage";

const preferences: DraftPreferences = {
  language: "cpp",
  theme: "catppuccin-mocha",
  bodyFontFamily: "Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif",
  bodyFontSize: "18px",
  selectionFontFamily: "Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif",
  selectionFontSize: "18px",
  codeFontSize: "16px",
  showLineNumbers: true,
  documentTheme: "darkEditorial",
  structure: "dcTable",
};

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const throwingStorage = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
  removeItem() {
    throw new Error("blocked");
  },
};

describe("draft storage", () => {
  it("round-trips a validated draft snapshot", () => {
    const storage = new MemoryStorage();
    const snapshot = createDraftSnapshot(sampleDocument, preferences);

    expect(writeDraftSnapshot(storage, snapshot)).toBe(true);

    const restored = readDraftSnapshot(storage);
    expect(restored?.version).toBe(1);
    expect(restored?.document).toEqual(sampleDocument);
    expect(restored?.preferences).toEqual(preferences);

    expect(clearDraftSnapshot(storage)).toBe(true);
    expect(storage.getItem(draftStorageKey)).toBeNull();
  });

  it("normalizes legacy modern export preferences to DC table", () => {
    const snapshot = createDraftSnapshot(sampleDocument, preferences);
    const restored = parseDraftSnapshot(
      JSON.stringify({
        ...snapshot,
        preferences: {
          ...snapshot.preferences,
          structure: "modern",
        },
      }),
    );

    expect(restored?.preferences.structure).toBe("dcTable");
  });

  it("rejects malformed or unsupported draft payloads", () => {
    expect(parseDraftSnapshot("{")).toBeUndefined();
    expect(parseDraftSnapshot(JSON.stringify({ version: 1 }))).toBeUndefined();
    expect(
      parseDraftSnapshot(
        JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          document: { type: 123 },
          preferences,
        }),
      ),
    ).toBeUndefined();
    expect(
      parseDraftSnapshot(
        JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          document: sampleDocument,
          preferences: { ...preferences, language: "brainfuck" },
        }),
      ),
    ).toBeUndefined();
  });

  it("restores legacy v1 drafts without a saved document theme", () => {
    const snapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      document: sampleDocument,
      preferences: {
        ...preferences,
        documentTheme: undefined,
      },
    };

    const restored = parseDraftSnapshot(JSON.stringify(snapshot));

    expect(restored?.preferences.documentTheme).toBe("lightLecture");
  });

  it("restores collapsed markdown table paragraphs in saved drafts", () => {
    const snapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      document: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "| 설정 항목 | 추천값 | 효과 | | --- | --- | --- | | 화면 밝기 | 자동 밝기 또는 40% 이하 | 최대 20% 절약 |",
              },
            ],
          },
        ],
      },
      preferences,
    };

    const restored = parseDraftSnapshot(JSON.stringify(snapshot));

    expect(restored?.document.content?.[0]).toEqual({
      type: "dcDataTable",
      content: [
        {
          type: "dcDataTableRow",
          content: [
            {
              type: "dcDataTableCell",
              attrs: { header: true },
              content: [{ type: "text", text: "설정 항목" }],
            },
            {
              type: "dcDataTableCell",
              attrs: { header: true },
              content: [{ type: "text", text: "추천값" }],
            },
            {
              type: "dcDataTableCell",
              attrs: { header: true },
              content: [{ type: "text", text: "효과" }],
            },
          ],
        },
        {
          type: "dcDataTableRow",
          content: [
            {
              type: "dcDataTableCell",
              content: [{ type: "text", text: "화면 밝기" }],
            },
            {
              type: "dcDataTableCell",
              content: [{ type: "text", text: "자동 밝기 또는 40% 이하" }],
            },
            {
              type: "dcDataTableCell",
              content: [{ type: "text", text: "최대 20% 절약" }],
            },
          ],
        },
      ],
    });
  });

  it("restores inline markdown in legacy custom block snapshots", () => {
    const snapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      document: {
        type: "doc",
        content: [
          {
            type: "summaryBox",
            attrs: { label: "체크" },
            content: [
              {
                type: "summaryItem",
                content: [{ type: "text", text: "`fcstValue`는 문자열이다." }],
              },
            ],
          },
          {
            type: "tutorialBlock",
            content: [
              {
                type: "tutorialStep",
                attrs: { title: "`items` 배열을 추출한다.", number: "01" },
                content: [],
              },
              {
                type: "tutorialStep",
                attrs: { title: "파싱 실패 시 에러를 로깅한다.", number: "04" },
                content: [],
              },
            ],
          },
          {
            type: "comparisonBlock",
            content: [
              {
                type: "comparisonColumn",
                attrs: { side: "left", title: "Before" },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "`int,string`으로 받는다." }],
                  },
                ],
              },
              {
                type: "comparisonColumn",
                attrs: { side: "right", title: "After" },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "`string`으로 보존한다." }],
                  },
                ],
              },
            ],
          },
        ],
      },
      preferences,
    };

    const restored = parseDraftSnapshot(JSON.stringify(snapshot));

    expect(restored?.document.content?.[0]?.content?.[0]?.content).toEqual([
      { type: "text", text: "fcstValue", marks: [{ type: "code" }] },
      { type: "text", text: "는 문자열이다." },
    ]);
    expect(restored?.document.content?.[1]?.content?.[0]).toEqual({
      type: "tutorialStep",
      attrs: { number: "01" },
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "items", marks: [{ type: "code" }] },
            { type: "text", text: " 배열을 추출한다." },
          ],
        },
      ],
    });
    expect(restored?.document.content?.[1]?.content?.[1]).toEqual({
      type: "tutorialStep",
      attrs: { number: "04" },
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "파싱 실패 시 에러를 로깅한다." }],
        },
      ],
    });
    expect(restored?.document.content?.[2]?.content?.[0]?.content?.[0]?.content).toEqual([
      { type: "text", text: "int,string", marks: [{ type: "code" }] },
      { type: "text", text: "으로 받는다." },
    ]);
  });

  it("restores saved code highlight ranges without decorative blank or closing lines", () => {
    const snapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      document: {
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: {
              language: "rust",
              highlightLines: "4-5,9",
              filename: "rust_vec.rs",
            },
            content: [
              {
                type: "text",
                text: [
                  "fn main() {",
                  "    let mut v = Vec::new();",
                  "    v.push(10);",
                  "    v.push(20);",
                  "    // Box는 scope를 벗어나면 자동 해제",
                  "    let p = Box::new(5);",
                  "",
                  '    println!("{}", v[0]);',
                  "}",
                ].join("\n"),
              },
            ],
          },
        ],
      },
      preferences,
    };

    const restored = parseDraftSnapshot(JSON.stringify(snapshot));

    expect(restored?.document.content?.[0]?.attrs).toEqual({
      language: "rust",
      highlightLines: "4-5",
      filename: "rust_vec.rs",
    });
  });

  it("treats storage failures as non-fatal", () => {
    const snapshot = createDraftSnapshot(sampleDocument, preferences);

    expect(readDraftSnapshot(throwingStorage)).toBeUndefined();
    expect(writeDraftSnapshot(throwingStorage, snapshot)).toBe(false);
    expect(clearDraftSnapshot(throwingStorage)).toBe(false);
  });

  it("round-trips validated draft history snapshots", () => {
    const storage = new MemoryStorage();
    const snapshot = createDraftHistorySnapshot(sampleDocument, preferences);

    expect(writeDraftHistorySnapshots(storage, [snapshot])).toBe(true);

    const restored = readDraftHistorySnapshots(storage);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toEqual(snapshot);

    expect(clearDraftHistorySnapshots(storage)).toBe(true);
    expect(storage.getItem(draftHistoryStorageKey)).toBeNull();
  });

  it("filters malformed draft history payloads and limits the list", () => {
    const validSnapshots = Array.from({ length: maxDraftHistoryCount + 3 }, () =>
      createDraftHistorySnapshot(sampleDocument, preferences),
    );
    const malformedSnapshot = {
      ...validSnapshots[0],
      id: 123,
    };

    const restored = parseDraftHistorySnapshots(
      JSON.stringify([malformedSnapshot, ...validSnapshots]),
    );

    expect(restored).toHaveLength(maxDraftHistoryCount);
    expect(restored[0]?.id).toBe(validSnapshots[0]?.id);
    expect(parseDraftHistorySnapshots("{")).toEqual([]);
    expect(parseDraftHistorySnapshots(JSON.stringify({ items: validSnapshots }))).toEqual([]);
  });

  it("appends and deletes draft history snapshots", () => {
    const storage = new MemoryStorage();
    const first = createDraftHistorySnapshot(sampleDocument, preferences);
    const second = createDraftHistorySnapshot(sampleDocument, {
      ...preferences,
      language: "typescript",
    });

    expect(appendDraftHistorySnapshot(storage, first)).toHaveLength(1);
    expect(appendDraftHistorySnapshot(storage, second).map((item) => item.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(deleteDraftHistorySnapshot(storage, second.id).map((item) => item.id)).toEqual([
      first.id,
    ]);
  });

  it("renames draft history snapshots while preserving unnamed legacy snapshots", () => {
    const storage = new MemoryStorage();
    const first = createDraftHistorySnapshot(sampleDocument, preferences);
    const second = createDraftHistorySnapshot(sampleDocument, {
      ...preferences,
      language: "typescript",
    });

    expect(writeDraftHistorySnapshots(storage, [first, second])).toBe(true);

    const renamed = renameDraftHistorySnapshot(storage, first.id, "  풀이   초안  ");

    expect(renamed[0]?.id).toBe(first.id);
    expect(renamed[0]?.name).toBe("풀이 초안");
    expect(renamed[0]?.document).toEqual(sampleDocument);
    expect(renamed[0]?.updatedAt).toBe(first.updatedAt);
    expect(renamed[1]?.name).toBeUndefined();
    expect(readDraftHistorySnapshots(storage)[0]?.name).toBe("풀이 초안");

    const cleared = renameDraftHistorySnapshot(storage, first.id, " ");

    expect(cleared[0]?.name).toBeUndefined();
  });

  it("treats draft history storage failures as non-fatal", () => {
    const snapshot = createDraftHistorySnapshot(sampleDocument, preferences);

    expect(readDraftHistorySnapshots(throwingStorage)).toEqual([]);
    expect(writeDraftHistorySnapshots(throwingStorage, [snapshot])).toBe(false);
    expect(appendDraftHistorySnapshot(throwingStorage, snapshot)).toEqual([]);
    expect(deleteDraftHistorySnapshot(throwingStorage, snapshot.id)).toEqual([]);
    expect(renameDraftHistorySnapshot(throwingStorage, snapshot.id, "새 이름")).toEqual([]);
    expect(clearDraftHistorySnapshots(throwingStorage)).toBe(false);
  });
});
