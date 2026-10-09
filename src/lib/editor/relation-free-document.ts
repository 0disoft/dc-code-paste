import type { JSONContent } from "@tiptap/core";
import { privateDocumentAttributes, privateNodeAttributes } from "./private-writing-metadata.ts";

/** Keep private writing metadata out of export and rejoin text split by anchor identities. */
export function relationFreeDocument(node: JSONContent): JSONContent {
  const privateMark = node.marks?.some((mark) => mark.type === "relationAnchor");
  const marks = privateMark
    ? node.marks!.filter((mark) => mark.type !== "relationAnchor")
    : node.marks;
  const content = node.content?.map(relationFreeDocument);
  const childrenChanged = content?.some((child, index) => child !== node.content![index]);
  const attributes = node.attrs;
  const privateNames = node.type === "doc" ? privateDocumentAttributes : privateNodeAttributes;
  const privateAttribute = attributes && privateNames.some((name) => name in attributes);
  if (!privateMark && !childrenChanged && !privateAttribute) return node;
  const result = { ...node };
  if (privateMark) {
    if (marks?.length) result.marks = marks;
    else delete result.marks;
  }
  if (privateAttribute) {
    const attrs = { ...node.attrs };
    for (const name of privateNames) delete attrs[name];
    if (Object.keys(attrs).length) result.attrs = attrs;
    else delete result.attrs;
  }
  if (childrenChanged && content) {
    const joined: JSONContent[] = [];
    for (const child of content) {
      const previous = joined.at(-1);
      if (
        previous?.type === "text" &&
        child.type === "text" &&
        JSON.stringify([previous.attrs, previous.marks]) ===
          JSON.stringify([child.attrs, child.marks])
      ) {
        joined[joined.length - 1] = {
          ...previous,
          text: `${previous.text ?? ""}${child.text ?? ""}`,
        };
      } else joined.push(child);
    }
    result.content = joined;
  }
  return result;
}
