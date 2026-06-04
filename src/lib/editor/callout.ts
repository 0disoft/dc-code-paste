export const calloutKinds = ["tip", "warning", "reference", "emphasis"] as const;

export type CalloutKind = (typeof calloutKinds)[number];

export const calloutNodeNames = ["tipBox", "warningBox", "referenceBox", "emphasisBox"] as const;

export type CalloutNodeName = (typeof calloutNodeNames)[number];

export const calloutNodeNameByKind: Record<CalloutKind, CalloutNodeName> = {
  tip: "tipBox",
  warning: "warningBox",
  reference: "referenceBox",
  emphasis: "emphasisBox",
};

export const calloutKindByNodeName: Record<CalloutNodeName, CalloutKind> = {
  tipBox: "tip",
  warningBox: "warning",
  referenceBox: "reference",
  emphasisBox: "emphasis",
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
