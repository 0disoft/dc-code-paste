import type { Editor, JSONContent } from "@tiptap/core";
import type { Node, Schema } from "@tiptap/pm/model";
import { closeHistory } from "@tiptap/pm/history";
import { Step, StepResult } from "@tiptap/pm/transform";
import { normalizeDraftPreferences, type DraftPreferences } from "./draft-storage";

const preferencesStepId = "dcDocumentPreferences";

/** Keeps workspace preferences in the same undo event as the document they belong to. */
export class DocumentPreferencesStep extends Step {
  readonly before: DraftPreferences;
  readonly after: DraftPreferences;

  constructor(before: DraftPreferences, after: DraftPreferences) {
    super();
    this.before = { ...before };
    this.after = { ...after };
  }

  apply(document: Node) {
    return StepResult.ok(document);
  }

  invert() {
    return new DocumentPreferencesStep(this.after, this.before);
  }

  map() {
    return this;
  }

  toJSON() {
    return { stepType: preferencesStepId, before: this.before, after: this.after };
  }

  static fromJSON(_schema: Schema, json: unknown) {
    if (!json || typeof json !== "object")
      throw new RangeError("Invalid document preferences step");
    const value = json as { before?: unknown; after?: unknown };
    const before = normalizeDraftPreferences(value.before);
    const after = normalizeDraftPreferences(value.after);
    if (!before || !after) throw new RangeError("Invalid document preferences step");
    return new DocumentPreferencesStep(before, after);
  }
}

Step.jsonID(preferencesStepId, DocumentPreferencesStep);

export function recordDocumentPreferencesChange(
  editor: Editor,
  before: DraftPreferences,
  after: DraftPreferences,
) {
  if (JSON.stringify(before) === JSON.stringify(after)) return false;
  editor.view.dispatch(
    closeHistory(editor.state.tr.step(new DocumentPreferencesStep(before, after))),
  );
  editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}

export function replaceDocumentWithPreferences(
  editor: Editor,
  document: JSONContent,
  before: DraftPreferences,
  after: DraftPreferences,
) {
  const replaced = editor
    .chain()
    .setContent(document)
    .command(({ tr }) => {
      closeHistory(tr);
      tr.step(new DocumentPreferencesStep(before, after));
      return true;
    })
    .run();
  // Following typing must not merge with the replacement, even when it happens immediately.
  if (replaced) editor.view.dispatch(closeHistory(editor.state.tr));
  return replaced;
}
