import { mergeAttributes, Node } from "@tiptap/core";
import type { CalloutKind, CalloutNodeName } from "./callout";

function createCalloutExtension(kind: CalloutKind, name: CalloutNodeName) {
  return Node.create({
    name,
    group: "block",
    content: "block+",
    defining: true,

    parseHTML() {
      return [{ tag: `aside[data-dc-callout][data-kind="${kind}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        "aside",
        mergeAttributes(HTMLAttributes, {
          "data-dc-callout": "",
          "data-kind": kind,
          class: `dc-callout dc-callout-${kind}`,
        }),
        0,
      ];
    },
  });
}

export const TipBox = createCalloutExtension("tip", "tipBox");
export const WarningBox = createCalloutExtension("warning", "warningBox");
export const ReferenceBox = createCalloutExtension("reference", "referenceBox");
export const EmphasisBox = createCalloutExtension("emphasis", "emphasisBox");
export const SuccessBox = createCalloutExtension("success", "successBox");
export const FailureBox = createCalloutExtension("failure", "failureBox");
export const ExperimentBox = createCalloutExtension("experiment", "experimentBox");
export const ConclusionBox = createCalloutExtension("conclusion", "conclusionBox");
export const RebuttalBox = createCalloutExtension("rebuttal", "rebuttalBox");

export const calloutExtensions = [
  TipBox,
  WarningBox,
  ReferenceBox,
  EmphasisBox,
  SuccessBox,
  FailureBox,
  ExperimentBox,
  ConclusionBox,
  RebuttalBox,
];
