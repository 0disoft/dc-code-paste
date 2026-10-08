import type { Mark } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";

export function readSelectionTextStyle(state: EditorState | undefined) {
  const values = {
    fontSize: new Set<string>(),
    fontFamily: new Set<string>(),
    color: new Set<string>(),
  };
  function collect(marks: readonly Mark[]) {
    const attrs = marks.find((mark) => mark.type.name === "textStyle")?.attrs;
    for (const key of ["fontSize", "fontFamily", "color"] as const) {
      values[key].add(typeof attrs?.[key] === "string" ? attrs[key] : "");
    }
  }
  if (state?.selection.empty) collect(state.storedMarks ?? state.selection.$from.marks());
  else if (state) {
    state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
      if (node.isText) collect(node.marks);
    });
  }
  return {
    fontSize: values.fontSize.size === 1 ? [...values.fontSize][0]! : "",
    fontSizeMixed: values.fontSize.size > 1,
    fontFamily: values.fontFamily.size === 1 ? [...values.fontFamily][0]! : "",
    fontFamilyMixed: values.fontFamily.size > 1,
    color: values.color.size === 1 ? [...values.color][0]! : "",
    colorMixed: values.color.size > 1,
    empty: state?.selection.empty ?? true,
    hasOverrides: Object.values(values).some((set) => [...set].some(Boolean)),
  };
}
