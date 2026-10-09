import { getSchema, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { expect, it } from "vitest";
import { createEditorExtensions } from "#lib/editor/extensions.ts";
import {
  createDocumentSourceReader,
  documentSourceCatalog,
  reuseDocumentSource,
} from "#lib/editor/document-sources.ts";

const schema = getSchema(createEditorExtensions());
const source = {
  href: "https://example.com/evidence",
  label: "실험 기록",
  excerpt: "첫 문장의 원문",
};
const marked = (text: string, attrs = source, extra: JSONContent[] = []): JSONContent => ({
  type: "text",
  text,
  marks: [{ type: "sentenceSource", attrs }, ...extra],
});
const document: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        marked("첫 ", source, [{ type: "bold" }]),
        marked("문장"),
        { type: "text", text: " 이어서 " },
        marked("또 다른 문장", { ...source, excerpt: "다른 근거" }),
      ],
    },
    {
      type: "paragraph",
      content: [
        marked("둘째 문장", {
          ...source,
          href: "https://EXAMPLE.COM/evidence",
          excerpt: "둘째 원문",
        }),
      ],
    },
    {
      type: "referenceList",
      content: [
        {
          type: "referenceItem",
          attrs: { href: source.href },
          content: [{ type: "text", text: "참고 목록의 이름" }],
        },
        {
          type: "referenceItem",
          attrs: { href: "https://example.com/reference" },
          content: [{ type: "text", text: "참고 문서" }],
        },
      ],
    },
  ],
};

it("groups adjacent styled fragments, deduplicates URLs and keeps each sentence's excerpt", () => {
  const doc = schema.nodeFromJSON(document);
  const entries = documentSourceCatalog(doc);
  expect(entries).toHaveLength(2);
  expect(entries[0]).toMatchObject({ href: source.href, label: source.label, referenceCount: 1 });
  expect(entries[0].mentions.map((mention) => [mention.text, mention.excerpt])).toEqual([
    ["첫 문장", "첫 문장의 원문"],
    ["또 다른 문장", "다른 근거"],
    ["둘째 문장", "둘째 원문"],
  ]);
  for (const entry of entries)
    for (const mention of entry.mentions)
      expect(doc.textBetween(mention.from, mention.to)).toBe(mention.text);
  expect(entries[1]).toMatchObject({ label: "참고 문서", mentions: [], referenceCount: 1 });
});

it("refreshes positions after moving and deleting content while reusing the catalog for cursor changes", () => {
  const read = createDocumentSourceReader();
  const state = EditorState.create({ doc: schema.nodeFromJSON(document) });
  const entries = read(state.doc);
  expect(read(state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2))).doc)).toBe(
    entries,
  );
  const prefix = schema.nodes.paragraph.create(null, schema.text("새 문단"));
  const shifted = state.apply(state.tr.insert(0, prefix));
  expect(read(shifted.doc)[0].mentions[0].from).toBe(entries[0].mentions[0].from + prefix.nodeSize);
  const deleted = shifted.apply(shifted.tr.delete(0, shifted.doc.content.size));
  expect(read(deleted.doc)).toEqual([]);
  expect(read(undefined)).toEqual([]);
});

it("reuses only the address and label, preserving the current excerpt only for the same URL", () => {
  const entries = documentSourceCatalog(schema.nodeFromJSON(document));
  const current = {
    href: "https://example.com/other",
    label: "내 이름",
    excerpt: "이 문장의 원문",
  };
  expect(reuseDocumentSource(current, entries[0])).toEqual({
    href: source.href,
    label: source.label,
    excerpt: "",
  });
  expect(reuseDocumentSource({ ...current, href: source.href }, entries[0]).excerpt).toBe(
    current.excerpt,
  );
  expect(entries[0].mentions[0].excerpt).toBe(source.excerpt);
  expect(current.excerpt).toBe("이 문장의 원문");
});

it("skips unsafe URLs, code and ordinary links, and keeps meaningful URL fragments separate", () => {
  const entries = documentSourceCatalog(
    schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            marked("inline", source, [{ type: "code" }]),
            {
              type: "text",
              text: "일반 링크",
              marks: [{ type: "link", attrs: { href: "https://example.com/ordinary" } }],
            },
            marked("첫 항목", { ...source, href: `${source.href}#one` }),
            marked("둘째 항목", { ...source, href: `${source.href}#two` }),
          ],
        },
        { type: "codeBlock", content: [marked("code")] },
        {
          type: "referenceList",
          content: [
            {
              type: "referenceItem",
              attrs: { href: "mailto:test@example.com" },
              content: [{ type: "text", text: "메일" }],
            },
            {
              type: "referenceItem",
              attrs: { href: "javascript:alert(1)" },
              content: [{ type: "text", text: "위험한 주소" }],
            },
          ],
        },
      ],
    }),
  );
  expect(entries.map((entry) => entry.href)).toEqual([`${source.href}#one`, `${source.href}#two`]);
});
