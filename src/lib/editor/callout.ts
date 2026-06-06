export const calloutKinds = [
  "tip",
  "warning",
  "reference",
  "emphasis",
  "success",
  "failure",
  "experiment",
  "conclusion",
  "rebuttal",
] as const;

export type CalloutKind = (typeof calloutKinds)[number];

export const calloutNodeNames = [
  "tipBox",
  "warningBox",
  "referenceBox",
  "emphasisBox",
  "successBox",
  "failureBox",
  "experimentBox",
  "conclusionBox",
  "rebuttalBox",
] as const;

export type CalloutNodeName = (typeof calloutNodeNames)[number];

export const calloutNodeNameByKind: Record<CalloutKind, CalloutNodeName> = {
  tip: "tipBox",
  warning: "warningBox",
  reference: "referenceBox",
  emphasis: "emphasisBox",
  success: "successBox",
  failure: "failureBox",
  experiment: "experimentBox",
  conclusion: "conclusionBox",
  rebuttal: "rebuttalBox",
};

export const calloutKindByNodeName: Record<CalloutNodeName, CalloutKind> = {
  tipBox: "tip",
  warningBox: "warning",
  referenceBox: "reference",
  emphasisBox: "emphasis",
  successBox: "success",
  failureBox: "failure",
  experimentBox: "experiment",
  conclusionBox: "conclusion",
  rebuttalBox: "rebuttal",
};

export function isCalloutKind(value: unknown): value is CalloutKind {
  return typeof value === "string" && calloutKinds.includes(value as CalloutKind);
}

export function normalizeCalloutKind(value: unknown): CalloutKind {
  return isCalloutKind(value) ? value : "tip";
}

export function isCalloutNodeName(value: unknown): value is CalloutNodeName {
  return typeof value === "string" && calloutNodeNames.includes(value as CalloutNodeName);
}

export function calloutKindFromNodeName(value: unknown): CalloutKind | undefined {
  return isCalloutNodeName(value) ? calloutKindByNodeName[value] : undefined;
}
