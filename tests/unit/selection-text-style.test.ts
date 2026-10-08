import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { expect, it } from "vitest";
import { createEditorExtensions } from "../../src/lib/editor/extensions";
import { readSelectionTextStyle } from "../../src/lib/editor/selection-text-style";

const schema = getSchema(createEditorExtensions());
const style = schema.marks.textStyle!.create({
  fontSize: "20px",
  fontFamily: "Georgia",
  color: "#2563eb",
});
const doc = schema.nodes.doc!.create(
  null,
  schema.nodes.paragraph!.create(null, [schema.text("앞", [style]), schema.text("뒤")]),
);

it("distinguishes a uniform selection from mixed inherited and explicit styles", () => {
  const uniform = EditorState.create({ doc, selection: TextSelection.create(doc, 1, 2) });
  expect(readSelectionTextStyle(uniform)).toMatchObject({
    fontSize: "20px",
    fontSizeMixed: false,
    color: "#2563eb",
    empty: false,
  });
  const mixed = EditorState.create({ doc, selection: TextSelection.create(doc, 1, 3) });
  expect(readSelectionTextStyle(mixed)).toMatchObject({
    fontSize: "",
    fontSizeMixed: true,
    fontFamilyMixed: true,
    colorMixed: true,
    hasOverrides: true,
  });
});

it("honors cleared stored marks at a caret beside styled text", () => {
  const state = EditorState.create({
    doc,
    selection: TextSelection.create(doc, 2),
    storedMarks: [],
  });
  expect(readSelectionTextStyle(state)).toMatchObject({
    fontSize: "",
    fontSizeMixed: false,
    hasOverrides: false,
    empty: true,
  });
});

it("uses inherited styles before the editor mounts", () => {
  expect(readSelectionTextStyle(undefined)).toMatchObject({
    fontSize: "",
    fontFamily: "",
    color: "",
    hasOverrides: false,
  });
});
