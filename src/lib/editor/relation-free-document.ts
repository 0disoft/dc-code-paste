import type { JSONContent } from "@tiptap/core";

/** Keep private connections out of export and rejoin text split only by anchor identities. */
export function relationFreeDocument(node: JSONContent): JSONContent {
  const privateMark = node.marks?.some((mark) => mark.type === "relationAnchor");
  const marks = privateMark
    ? node.marks!.filter((mark) => mark.type !== "relationAnchor")
    : node.marks;
  const content = node.content?.map(relationFreeDocument);
  const childrenChanged = content?.some((child, index) => child !== node.content![index]);
  const privateAttribute =
    node.type === "doc" &&
    node.attrs &&
    ("sentenceRelations" in node.attrs || "readingNotes" in node.attrs);
  if (!privateMark && !childrenChanged && !privateAttribute) return node;
  const result = { ...node };
  if (privateMark) {
    if (marks?.length) result.marks = marks;
    else delete result.marks;
  }
  if (privateAttribute) {
    const attrs = { ...node.attrs };
    delete attrs.sentenceRelations;
    delete attrs.readingNotes;
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
