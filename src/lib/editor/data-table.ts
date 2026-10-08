import { DOMParser, Fragment, type Schema } from "prosemirror-model";

export function normalizeTableSpan(value: unknown): number {
  const number = typeof value === "number" || typeof value === "string" ? Number(value) : 1;
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, 1000) : 1;
}

const blockTags =
  "p,div,section,article,blockquote,pre,h1,h2,h3,h4,h5,h6,ul,ol,li,table,thead,tbody,tfoot,tr,td,th,caption";

function meaningfulSibling(node: ChildNode | null, direction: "previousSibling" | "nextSibling") {
  while (node?.nodeType === 3 && !node.textContent?.trim()) node = node[direction];
  return node;
}

function parseCellContent(element: HTMLElement, schema: Schema): Fragment {
  const clone = element.cloneNode(true) as HTMLElement;
  // Cells store inline content. Keep block boundaries as editable line breaks
  // before flattening paragraph, list and nested-table wrappers.
  for (const block of Array.from(clone.querySelectorAll(blockTags)).reverse()) {
    const before = meaningfulSibling(block.previousSibling, "previousSibling");
    const after = meaningfulSibling(block.nextSibling, "nextSibling");
    if (before && before.nodeName !== "BR") block.before(element.ownerDocument.createElement("br"));
    if (after && after.nodeName !== "BR") block.after(element.ownerDocument.createElement("br"));
    const inline = element.ownerDocument.createElement("span");
    const style = block.getAttribute("style");
    if (style) inline.setAttribute("style", style);
    inline.append(...Array.from(block.childNodes));
    block.replaceWith(inline);
  }

  const container = element.ownerDocument.createElement("div");
  const inline = element.ownerDocument.createElement("span");
  const style = element.getAttribute("style");
  if (style) inline.setAttribute("style", style);
  inline.append(...Array.from(clone.childNodes));
  container.append(inline);
  return DOMParser.fromSchema(schema).parse(container, {
    topNode: schema.nodes.dcDataTableCell.create(),
  }).content;
}

function tableRows(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>("tr")).filter(
    (row) => row.closest("table") === element,
  );
}

export function isPastedDataTable(element: HTMLElement): boolean {
  const role = element.getAttribute("role")?.toLowerCase();
  return (
    role !== "presentation" &&
    role !== "none" &&
    tableRows(element).some((row) =>
      Array.from(row.children).some((cell) => /^(?:TD|TH)$/.test(cell.tagName)),
    )
  );
}

export function parsePastedDataTable(element: HTMLElement, schema: Schema): Fragment {
  const content = [];
  const caption = Array.from(element.children).find((child) => child.tagName === "CAPTION");
  if (caption) {
    content.push(
      schema.nodes.dcDataTableCaption.create(
        null,
        parseCellContent(caption as HTMLElement, schema),
      ),
    );
  }
  for (const row of tableRows(element)) {
    const cells = Array.from(row.children).filter((cell) => /^(?:TD|TH)$/.test(cell.tagName));
    const siblings = Array.from(row.parentElement?.children ?? []).filter(
      (child) => child.tagName === "TR",
    );
    const nodes = cells.map((cell) =>
      schema.nodes.dcDataTableCell.create(
        {
          header: cell.tagName === "TH",
          colspan: normalizeTableSpan(cell.getAttribute("colspan")),
          rowspan:
            cell.getAttribute("rowspan") === "0"
              ? normalizeTableSpan(siblings.length - siblings.indexOf(row))
              : normalizeTableSpan(cell.getAttribute("rowspan")),
        },
        parseCellContent(cell as HTMLElement, schema),
      ),
    );
    if (nodes.length) content.push(schema.nodes.dcDataTableRow.create(null, nodes));
  }
  return Fragment.fromArray(content);
}
