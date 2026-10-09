import { normalizeEditableLinkHref } from "./link.ts";
import type {
  RoundtripBlock,
  RoundtripList,
  RoundtripRange,
  RoundtripSnapshot,
} from "./roundtrip-comparison.ts";

export const maxRoundtripHtmlChars = 1_500_000;
export const maxRoundtripBlocks = 4000;
const blockTags = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "PRE",
  "BLOCKQUOTE",
  "LI",
  "TD",
  "TH",
  "TABLE",
  "TR",
  "UL",
  "OL",
  "FIGURE",
  "FIGCAPTION",
  "CAPTION",
]);
const selector = Array.from(blockTags).join(",");
const ignoredTags = new Set([
  "SCRIPT",
  "STYLE",
  "TEMPLATE",
  "NOSCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "MATH",
  "HEAD",
  "META",
  "LINK",
  "FORM",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "BUTTON",
]);

function ignored(element: Element) {
  const style = (element as HTMLElement).style;
  return (
    ignoredTags.has(element.tagName) ||
    element.hasAttribute("hidden") ||
    style?.display === "none" ||
    style?.visibility === "hidden"
  );
}

function readText(root: Node, excluded = new Set<Node>(), preserveWhitespace = false): string {
  const pieces: string[] = [];
  const pending: (Node | string)[] = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if (typeof node === "string") {
      pieces.push(node);
      continue;
    }
    if (excluded.has(node)) continue;
    if (node.nodeType === 3) pieces.push(node.textContent ?? "");
    else if (node.nodeType === 1) {
      const element = node as Element;
      if (ignored(element)) continue;
      if (element.tagName === "BR") pieces.push("\n");
      else {
        if (!preserveWhitespace && blockTags.has(element.tagName)) {
          pieces.push(" ");
          pending.push(" ");
        }
        for (const child of Array.from(node.childNodes).reverse()) pending.push(child);
      }
    } else for (const child of Array.from(node.childNodes).reverse()) pending.push(child);
  }
  return pieces.join("");
}

function words(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function parse(html: string) {
  if (!html.trim()) throw new Error("붙여넣은 내용이 없습니다.");
  if (html.length > maxRoundtripHtmlChars)
    throw new Error("비교할 내용이 너무 큽니다. 150만 자 이하로 가져와 주세요.");
  const template = document.createElement("template");
  // Template contents remain inert: pasted resources and event handlers never mount.
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, 0xffffffff);
  let count = 0;
  while (walker.nextNode())
    if (++count > 20_000)
      throw new Error("비교할 글의 구조가 너무 복잡합니다. 더 작은 구간으로 가져와 주세요.");
  return template.content;
}

export function roundtripHtmlSnapshot(html: string): RoundtripSnapshot {
  const root = parse(html);
  for (const element of Array.from(root.querySelectorAll("*")))
    if (ignored(element)) element.remove();
  const markerCells = new Set<Node>();
  const listContainers = new Set<Node>();
  const candidates: { element: Element; ordered: boolean; markers: string[]; items: Element[] }[] =
    [];
  for (const element of Array.from(root.querySelectorAll("ul,ol,table"))) {
    if (element.tagName !== "TABLE") {
      const items = Array.from(element.children).filter((child) => child.tagName === "LI");
      const ordered = element.tagName === "OL";
      const reversed = element.hasAttribute("reversed");
      let number = Number(element.getAttribute("start") ?? (reversed ? items.length : 1));
      if (!Number.isSafeInteger(number)) number = 1;
      const markers = items.map((item) => {
        const explicit = item.getAttribute("value");
        if (explicit !== null && Number.isSafeInteger(Number(explicit))) number = Number(explicit);
        const marker = ordered ? `${number}.` : "•";
        number += reversed ? -1 : 1;
        return marker;
      });
      if (items.length) candidates.push({ element, ordered, markers, items });
    } else {
      const rows = Array.from(element.querySelectorAll("tr")).filter(
        (row) => row.closest("table") === element,
      );
      const markers: string[] = [];
      const items: Element[] = [];
      const cells: Element[] = [];
      for (const row of rows) {
        const children = Array.from(row.children).filter(
          (cell) => cell.tagName === "TD" || cell.tagName === "TH",
        );
        if (children.length !== 2) continue;
        const marker = words(readText(children[0]));
        if (!/^(?:\d+\.|[•▪●◦‣])$/.test(marker)) continue;
        markers.push(/^\d/.test(marker) ? marker : "•");
        items.push(children[1]);
        cells.push(children[0]);
      }
      if (items.length && items.length === rows.length) {
        candidates.push({ element, ordered: /^\d/.test(markers[0]), markers, items });
        cells.forEach((cell) => markerCells.add(cell));
      }
    }
  }
  candidates.forEach((candidate) => listContainers.add(candidate.element));
  const lists: RoundtripList[] = candidates.map((candidate) => ({
    ordered: candidate.ordered,
    markers: candidate.markers,
    items: candidate.items.map((item) => words(readText(item, listContainers))),
  }));
  const blocks: RoundtripBlock[] = [];
  let length = 0;
  function add(text: string, code: boolean, range: RoundtripRange) {
    text = code ? text.replace(/\r\n?/g, "\n") : words(text);
    if (!text.trim()) return;
    length += text.length;
    if (blocks.length >= maxRoundtripBlocks || length > 200_000)
      throw new Error("비교할 본문이 너무 깁니다. 더 작은 구간으로 가져와 주세요.");
    blocks.push({ index: blocks.length, text, code, range });
  }
  function collect(container: Node, path: number[], depth: number) {
    if (depth > 80)
      throw new Error("비교할 글의 구조가 너무 깊습니다. 더 작은 구간으로 가져와 주세요.");
    if (markerCells.has(container)) return;
    const element = container.nodeType === 1 ? (container as Element) : undefined;
    if (element && ignored(element)) return;
    if (element?.tagName === "PRE") {
      add(readText(container, undefined, true), true, {
        path,
        start: 0,
        end: container.childNodes.length,
      });
      return;
    }
    if (element && blockTags.has(element.tagName) && !element.querySelector(selector)) {
      add(readText(container), false, { path, start: 0, end: container.childNodes.length });
      return;
    }
    const children = Array.from(container.childNodes);
    let start = -1;
    function flush(end: number) {
      if (start < 0) return;
      add(
        children
          .slice(start, end)
          .map((child) => readText(child))
          .join(""),
        false,
        { path, start, end },
      );
      start = -1;
    }
    children.forEach((child, index) => {
      const nested = child.nodeType === 1 ? (child as Element) : undefined;
      if (nested && (blockTags.has(nested.tagName) || nested.querySelector(selector))) {
        flush(index);
        collect(child, [...path, index], depth + 1);
      } else if (start < 0) start = index;
    });
    flush(children.length);
  }
  collect(root, [], 0);
  const links = Array.from(root.querySelectorAll("a[href]")).map((element) => {
    const raw = element.getAttribute("href")!.trim();
    return {
      label: words(readText(element)),
      href: /^[a-z][\w+.-]*:/i.test(raw) ? (normalizeEditableLinkHref(raw) ?? raw) : raw,
    };
  });
  const styles = Array.from(root.querySelectorAll("[style]"))
    .map((element) =>
      Array.from((element as HTMLElement).style)
        .sort()
        .map(
          (property) =>
            `${property}:${(element as HTMLElement).style.getPropertyValue(property).trim()}`,
        )
        .join(";"),
    )
    .filter(Boolean)
    .join("\n");
  return { mode: "html", blocks, links, lists, styles };
}

/** Rebuild only the chosen saved passage while retaining its containing layout styles. */
export function roundtripOriginalFragment(html: string, block: RoundtripBlock) {
  if (!block.range) throw new Error("이 구간의 복사 당시 서식을 찾을 수 없습니다.");
  const root = parse(html);
  // Keep paths identical to snapshot extraction before resolving the saved range.
  for (const element of Array.from(root.querySelectorAll("*")))
    if (ignored(element)) element.remove();
  let container: Node = root;
  for (const index of block.range.path) {
    const child = container.childNodes[index];
    if (!child) throw new Error("복사 기록이 바뀌었습니다. 다시 비교해 주세요.");
    container = child;
  }
  const copy = container.cloneNode(false);
  Array.from(container.childNodes)
    .slice(block.range.start, block.range.end)
    .forEach((child) => copy.appendChild(child.cloneNode(true)));
  const text = block.code
    ? readText(copy, undefined, true).replace(/\r\n?/g, "\n")
    : words(readText(copy));
  if (text !== block.text) throw new Error("복사 기록의 구간이 바뀌었습니다. 다시 비교해 주세요.");
  let fragment = copy;
  for (let parent = container.parentNode; parent && parent !== root; parent = parent.parentNode) {
    const wrapper = parent.cloneNode(false);
    wrapper.appendChild(fragment);
    fragment = wrapper;
  }
  const holder = document.createElement("template");
  holder.content.appendChild(fragment);
  // Only saved content is copied. Strip active attributes even from modified local records.
  const safeTags = new Set([
    "A",
    "B",
    "STRONG",
    "I",
    "EM",
    "S",
    "U",
    "CODE",
    "SPAN",
    "BR",
    "HR",
    "THEAD",
    "TBODY",
    "TFOOT",
    ...blockTags,
  ]);
  const safeAttributes = new Set([
    "href",
    "target",
    "rel",
    "style",
    "colspan",
    "rowspan",
    "width",
    "height",
    "valign",
    "align",
    "bgcolor",
    "role",
    "start",
    "value",
    "reversed",
    "scope",
    "cellpadding",
    "cellspacing",
    "border",
  ]);
  const safeStyles = new Set([
    "color",
    "background-color",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "text-align",
    "text-decoration",
    "text-decoration-line",
    "text-underline-offset",
    "vertical-align",
    "white-space",
    "word-break",
    "overflow-wrap",
    "width",
    "max-width",
    "min-width",
    "height",
    "display",
    "table-layout",
    "border-collapse",
    "border-spacing",
    "border-radius",
    "border",
    "border-top",
    "border-bottom",
    "border-left",
    "border-right",
    "padding",
    "padding-top",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "margin",
    "margin-top",
    "margin-bottom",
    "margin-left",
    "margin-right",
  ]);
  for (const element of Array.from(holder.content.querySelectorAll("*"))) {
    if (!safeTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!safeAttributes.has(attribute.name)) element.removeAttribute(attribute.name);
    }
    if (element.hasAttribute("href") && !normalizeEditableLinkHref(element.getAttribute("href")!))
      element.removeAttribute("href");
    const style = (element as HTMLElement).style;
    for (const property of Array.from(style))
      if (
        !safeStyles.has(property) ||
        /url\s*\(|@import|image-set\s*\(|expression\s*\(/i.test(style.getPropertyValue(property))
      )
        style.removeProperty(property);
  }
  return { html: holder.innerHTML, plainText: block.text };
}
