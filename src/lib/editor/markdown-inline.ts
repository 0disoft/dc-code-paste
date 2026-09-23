import type { JSONContent } from "@tiptap/core";
import { normalizeEditableLinkHref } from "$lib/editor/link";

type InlineMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export function textNode(text: string, marks?: InlineMark[]): JSONContent | undefined {
  if (!text) {
    return undefined;
  }

  return marks && marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

export function compactContent(content: Array<JSONContent | undefined>): JSONContent[] | undefined {
  const nextContent = content.filter((item): item is JSONContent => Boolean(item));
  return nextContent.length > 0 ? nextContent : undefined;
}

function isEscaped(value: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function findMatchingBracket(value: string, start: number, open: string, close: string): number {
  let depth = 1;
  for (let index = start; index < value.length; index += 1) {
    if (isEscaped(value, index)) continue;
    if (value[index] === open) depth += 1;
    if (value[index] === close && --depth === 0) return index;
  }
  return -1;
}

function appendNodes(content: JSONContent[], nodes: JSONContent[], mark?: InlineMark) {
  for (const node of nodes) {
    if (node.type !== "text" || !node.text) continue;
    const marks = mark ? [mark, ...(node.marks ?? [])] : node.marks;
    const previous = content.at(-1);
    if (previous?.type === "text" && JSON.stringify(previous.marks) === JSON.stringify(marks)) {
      previous.text = `${previous.text ?? ""}${node.text}`;
    } else {
      content.push(
        marks?.length
          ? { type: "text", text: node.text, marks }
          : { type: "text", text: node.text },
      );
    }
  }
}

function parseInlineSegment(
  value: string,
  start = 0,
  closing?: string,
  depth = 0,
): { content: JSONContent[]; index: number; closed: boolean } {
  const content: JSONContent[] = [];
  let plain = "";
  let index = start;
  const flush = () => {
    if (plain) appendNodes(content, [{ type: "text", text: plain }]);
    plain = "";
  };

  while (index < value.length) {
    const char = value[index] ?? "";
    const next = value[index + 1] ?? "";
    if (closing && value.startsWith(closing, index) && !isEscaped(value, index)) {
      const nestedBold =
        closing.length === 1 &&
        value.startsWith(char.repeat(2), index) &&
        !value.startsWith(char.repeat(3), index) &&
        next === char &&
        Boolean(value[index + 2] && !/\s/.test(value[index + 2]));
      if (!nestedBold) {
        flush();
        return { content, index: index + closing.length, closed: true };
      }
    }

    if (char === "\\" && next && /[\\`*_[\]()]/.test(next)) {
      plain += next;
      index += 2;
      continue;
    }

    if (char === "`") {
      const run = /^`+/.exec(value.slice(index))?.[0] ?? "`";
      let end = value.indexOf(run, index + run.length);
      while (end >= 0 && (value[end + run.length] === "`" || isEscaped(value, end))) {
        end = value.indexOf(run, end + run.length);
      }
      if (end > index + run.length) {
        flush();
        appendNodes(content, [{ type: "text", text: value.slice(index + run.length, end) }], {
          type: "code",
        });
        index = end + run.length;
        continue;
      }
    }

    if (char === "[") {
      const labelEnd = findMatchingBracket(value, index + 1, "[", "]");
      if (labelEnd >= 0 && value[labelEnd + 1] === "(") {
        const urlEnd = findMatchingBracket(value, labelEnd + 2, "(", ")");
        if (urlEnd >= 0) {
          const raw = value.slice(index, urlEnd + 1);
          const href = normalizeEditableLinkHref(
            value.slice(labelEnd + 2, urlEnd).replace(/\\([()])/g, "$1"),
          );
          flush();
          if (href) {
            const label = value.slice(index + 1, labelEnd);
            const link = {
              type: "link",
              attrs: { href, target: "_blank", rel: "noopener noreferrer" },
            };
            const labelNodes =
              depth < 16
                ? parseInlineSegment(label, 0, undefined, depth + 1).content
                : [{ type: "text", text: label }];
            appendNodes(content, labelNodes, link);
          } else {
            appendNodes(content, [{ type: "text", text: raw }]);
          }
          index = urlEnd + 1;
          continue;
        }
      }
    }

    if (char === "*" || char === "_") {
      const prev = value[index - 1] ?? "";
      const inWord = char === "_" && /[\p{L}\p{N}]/u.test(prev) && /[\p{L}\p{N}]/u.test(next);
      if (!inWord && next && !/\s/.test(next) && depth < 16) {
        const delimiter = next === char ? char.repeat(2) : char;
        if (value.indexOf(delimiter, index + delimiter.length) < 0) {
          plain += char;
          index += 1;
          continue;
        }
        const nested = parseInlineSegment(value, index + delimiter.length, delimiter, depth + 1);
        if (nested.closed && nested.content.length > 0) {
          flush();
          appendNodes(content, nested.content, {
            type: delimiter.length === 2 ? "bold" : "italic",
          });
          index = nested.index;
          continue;
        }
      }
    }

    plain += char;
    index += 1;
  }

  flush();
  return { content, index, closed: false };
}

export function containsMarkdownInlineToken(value: string): boolean {
  return parseMarkdownInline(value)?.some((node) => (node.marks?.length ?? 0) > 0) ?? false;
}

export function parseMarkdownInline(value: string): JSONContent[] | undefined {
  return compactContent(parseInlineSegment(value).content);
}
