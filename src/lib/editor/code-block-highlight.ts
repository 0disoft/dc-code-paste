import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { isSupportedLanguage, type DcLanguageId } from "$lib/highlighter/catalog";
import { highlightedLineIndexes } from "$lib/highlighter/highlight-lines";

export type EditorCodeTokenKind = "comment" | "string" | "keyword" | "number" | "function";

export type EditorCodeToken = {
  from: number;
  to: number;
  kind: EditorCodeTokenKind;
};

export type EditorCodeLineDecorationKind = "highlight" | "addition" | "deletion";

export type EditorCodeLineDecoration = {
  from: number;
  to: number;
  kind: EditorCodeLineDecorationKind;
  empty?: boolean;
};

type CodeLineDecorationAttrs = {
  highlightLines?: unknown;
  additionLines?: unknown;
  deletionLines?: unknown;
};

const keywordSets: Partial<Record<DcLanguageId, readonly string[]>> = {
  c: [
    "auto",
    "break",
    "case",
    "char",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extern",
    "float",
    "for",
    "goto",
    "if",
    "inline",
    "int",
    "long",
    "register",
    "return",
    "short",
    "signed",
    "sizeof",
    "static",
    "struct",
    "switch",
    "typedef",
    "union",
    "unsigned",
    "void",
    "volatile",
    "while",
  ],
  cpp: [
    "alignas",
    "auto",
    "bool",
    "break",
    "case",
    "catch",
    "char",
    "class",
    "concept",
    "const",
    "constexpr",
    "continue",
    "decltype",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "explicit",
    "false",
    "float",
    "for",
    "if",
    "inline",
    "int",
    "long",
    "namespace",
    "new",
    "noexcept",
    "nullptr",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "sizeof",
    "static",
    "struct",
    "switch",
    "template",
    "this",
    "throw",
    "true",
    "try",
    "typename",
    "using",
    "void",
    "while",
  ],
  javascript: [
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "let",
    "new",
    "null",
    "of",
    "return",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "undefined",
    "var",
    "void",
    "while",
    "yield",
  ],
  typescript: [
    "abstract",
    "as",
    "async",
    "await",
    "boolean",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "declare",
    "default",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "interface",
    "keyof",
    "let",
    "module",
    "namespace",
    "never",
    "new",
    "null",
    "number",
    "of",
    "private",
    "protected",
    "public",
    "readonly",
    "return",
    "string",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "type",
    "typeof",
    "undefined",
    "unknown",
    "var",
    "void",
    "while",
  ],
  go: [
    "break",
    "case",
    "chan",
    "const",
    "continue",
    "default",
    "defer",
    "else",
    "fallthrough",
    "for",
    "func",
    "go",
    "goto",
    "if",
    "import",
    "interface",
    "map",
    "package",
    "range",
    "return",
    "select",
    "struct",
    "switch",
    "type",
    "var",
  ],
  java: [
    "abstract",
    "boolean",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "else",
    "enum",
    "extends",
    "false",
    "final",
    "finally",
    "for",
    "if",
    "implements",
    "import",
    "instanceof",
    "interface",
    "new",
    "null",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "void",
    "while",
  ],
  python: [
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "False",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "None",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "True",
    "try",
    "while",
    "with",
    "yield",
  ],
  rust: [
    "as",
    "async",
    "await",
    "break",
    "const",
    "continue",
    "crate",
    "else",
    "enum",
    "extern",
    "false",
    "fn",
    "for",
    "if",
    "impl",
    "in",
    "let",
    "loop",
    "match",
    "mod",
    "move",
    "mut",
    "pub",
    "ref",
    "return",
    "self",
    "Self",
    "static",
    "struct",
    "super",
    "trait",
    "true",
    "type",
    "unsafe",
    "use",
    "where",
    "while",
  ],
  bash: [
    "case",
    "do",
    "done",
    "elif",
    "else",
    "esac",
    "fi",
    "for",
    "function",
    "if",
    "in",
    "select",
    "then",
    "until",
    "while",
  ],
  json: ["false", "null", "true"],
  yaml: ["false", "null", "off", "on", "true", "yes", "no"],
  toml: ["false", "true"],
  mermaid: [
    "activate",
    "alt",
    "and",
    "class",
    "classDef",
    "click",
    "deactivate",
    "else",
    "end",
    "erDiagram",
    "flowchart",
    "gantt",
    "gitGraph",
    "graph",
    "journey",
    "loop",
    "mindmap",
    "note",
    "opt",
    "participant",
    "pie",
    "quadrantChart",
    "sequenceDiagram",
    "stateDiagram",
    "stateDiagram-v2",
    "subgraph",
    "timeline",
  ],
  sql: [
    "add",
    "alter",
    "and",
    "as",
    "asc",
    "between",
    "by",
    "case",
    "create",
    "delete",
    "desc",
    "distinct",
    "drop",
    "else",
    "end",
    "exists",
    "false",
    "from",
    "group",
    "having",
    "in",
    "inner",
    "insert",
    "into",
    "is",
    "join",
    "left",
    "like",
    "limit",
    "not",
    "null",
    "on",
    "or",
    "order",
    "outer",
    "right",
    "select",
    "set",
    "table",
    "then",
    "true",
    "union",
    "update",
    "values",
    "when",
    "where",
  ],
  asm: [
    "add",
    "and",
    "bits",
    "bss",
    "call",
    "cmp",
    "data",
    "db",
    "dd",
    "dec",
    "dq",
    "dw",
    "equ",
    "extern",
    "global",
    "idiv",
    "imul",
    "inc",
    "int",
    "je",
    "jg",
    "jge",
    "jl",
    "jle",
    "jmp",
    "jne",
    "lea",
    "mov",
    "mul",
    "nop",
    "not",
    "or",
    "pop",
    "push",
    "ret",
    "section",
    "shl",
    "shr",
    "sub",
    "syscall",
    "text",
    "xor",
  ],
};

const cFamilyLanguages = new Set<DcLanguageId>([
  "c",
  "cpp",
  "csharp",
  "java",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "go",
  "rust",
  "scala",
  "zig",
  "julia",
  "mojo",
]);

const hashCommentLanguages = new Set<DcLanguageId>(["bash", "python", "yaml", "toml"]);

const htmlLikeLanguages = new Set<DcLanguageId>(["html", "svelte", "astro", "tailwind", "unocss"]);

const cssLikeLanguages = new Set<DcLanguageId>(["css"]);

type ProtectedRange = {
  from: number;
  to: number;
};

const codeBlockHighlightPluginKey = new PluginKey<DecorationSet>("dcCodeBlockHighlight");
const tokenCache = new Map<string, readonly EditorCodeToken[]>();
const maxTokenCacheEntries = 100;

function normalizeEditorCodeLanguage(value: unknown): DcLanguageId {
  return typeof value === "string" && isSupportedLanguage(value) ? value : "cpp";
}

function cachedTokenKey(code: string, language: DcLanguageId): string {
  return `${language}\u0000${code}`;
}

function rememberTokens(key: string, tokens: readonly EditorCodeToken[]): void {
  tokenCache.delete(key);
  tokenCache.set(key, tokens);

  if (tokenCache.size <= maxTokenCacheEntries) {
    return;
  }

  const oldestKey = tokenCache.keys().next().value;
  if (oldestKey) {
    tokenCache.delete(oldestKey);
  }
}

function cloneTokens(tokens: readonly EditorCodeToken[]): EditorCodeToken[] {
  return tokens.map((token) => ({ ...token }));
}

function keywordRegexFor(language: DcLanguageId): RegExp | undefined {
  const languageKeywords =
    keywordSets[language] ??
    (language === "jsx" || language === "tsx" ? keywordSets.typescript : undefined);

  if (!languageKeywords || languageKeywords.length === 0) {
    return undefined;
  }

  return new RegExp(`\\b(${languageKeywords.join("|")})\\b`, language === "sql" ? "gi" : "g");
}

function keywordSetFor(language: DcLanguageId): ReadonlySet<string> {
  const languageKeywords =
    keywordSets[language] ??
    (language === "jsx" || language === "tsx" ? keywordSets.typescript : undefined) ??
    [];

  return new Set(languageKeywords);
}

function lineCommentPrefixes(language: DcLanguageId): readonly string[] {
  if (language === "asm") {
    return [";", "#"];
  }

  if (hashCommentLanguages.has(language)) {
    return ["#"];
  }

  if (language === "haskell" || language === "sql") {
    return ["--"];
  }

  if (language === "mermaid") {
    return ["%%"];
  }

  if (cFamilyLanguages.has(language)) {
    return ["//"];
  }

  return [];
}

function blockCommentDelimiter(
  language: DcLanguageId,
): { open: string; close: string } | undefined {
  return cFamilyLanguages.has(language) || cssLikeLanguages.has(language)
    ? { open: "/*", close: "*/" }
    : undefined;
}

function pushToken(
  tokens: EditorCodeToken[],
  protectedRanges: ProtectedRange[],
  token: EditorCodeToken,
): void {
  if (token.to <= token.from) {
    return;
  }

  tokens.push(token);
  protectedRanges.push({ from: token.from, to: token.to });
}

function findLineCommentStart(line: string, index: number, language: DcLanguageId): number {
  for (const prefix of lineCommentPrefixes(language)) {
    if (line.startsWith(prefix, index)) {
      return index;
    }
  }

  if (htmlLikeLanguages.has(language) && line.startsWith("<!--", index)) {
    return index;
  }

  return -1;
}

function scanProtectedTokens(
  line: string,
  lineOffset: number,
  language: DcLanguageId,
  tokens: EditorCodeToken[],
  protectedRanges: ProtectedRange[],
): void {
  let index = 0;

  while (index < line.length) {
    const commentStart = findLineCommentStart(line, index, language);
    if (commentStart === index) {
      pushToken(tokens, protectedRanges, {
        from: lineOffset + index,
        to: lineOffset + line.length,
        kind: "comment",
      });
      return;
    }

    const blockComment = blockCommentDelimiter(language);
    if (blockComment && line.startsWith(blockComment.open, index)) {
      const commentEnd = line.indexOf(blockComment.close, index + blockComment.open.length);
      const to = commentEnd === -1 ? line.length : commentEnd + blockComment.close.length;

      pushToken(tokens, protectedRanges, {
        from: lineOffset + index,
        to: lineOffset + to,
        kind: "comment",
      });
      index = to;
      continue;
    }

    const char = line[index];
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      let end = index + 1;
      let escaped = false;

      while (end < line.length) {
        const next = line[end];

        if (escaped) {
          escaped = false;
        } else if (next === "\\") {
          escaped = true;
        } else if (next === quote) {
          end += 1;
          break;
        }

        end += 1;
      }

      pushToken(tokens, protectedRanges, {
        from: lineOffset + index,
        to: lineOffset + Math.min(end, line.length),
        kind: "string",
      });
      index = end;
      continue;
    }

    index += 1;
  }
}

function isProtected(index: number, protectedRanges: readonly ProtectedRange[]): boolean {
  return protectedRanges.some((range) => index >= range.from && index < range.to);
}

function scanRegexTokens(
  line: string,
  lineOffset: number,
  protectedRanges: readonly ProtectedRange[],
  regex: RegExp,
  kind: EditorCodeTokenKind,
  tokens: EditorCodeToken[],
): void {
  for (const match of line.matchAll(regex)) {
    if (match.index === undefined) {
      continue;
    }

    const from = lineOffset + match.index;
    const value = match[0] ?? "";
    const to = from + value.length;

    if (!value || isProtected(from, protectedRanges)) {
      continue;
    }

    tokens.push({ from, to, kind });
  }
}

function scanMarkdownTokens(
  line: string,
  lineOffset: number,
  protectedRanges: readonly ProtectedRange[],
  tokens: EditorCodeToken[],
): void {
  scanRegexTokens(
    line,
    lineOffset,
    protectedRanges,
    /^\s{0,3}#{1,6}(?=\s|$)|^\s{0,3}(?:[-*+]|\d+\.)\s|^\s{0,3}>+\s?/g,
    "keyword",
    tokens,
  );
  scanRegexTokens(line, lineOffset, protectedRanges, /```+[^`]*|~~~+[^~]*/g, "keyword", tokens);
  scanRegexTokens(line, lineOffset, protectedRanges, /\[[^\]]+]\([^)]+\)/g, "string", tokens);
}

function scanFunctionTokens(
  line: string,
  lineOffset: number,
  language: DcLanguageId,
  protectedRanges: readonly ProtectedRange[],
  tokens: EditorCodeToken[],
): void {
  const keywords = keywordSetFor(language);

  for (const match of line.matchAll(/\b[A-Za-z_][\w$]*(?=\s*\()/g)) {
    if (match.index === undefined) {
      continue;
    }

    const value = match[0] ?? "";
    const from = lineOffset + match.index;

    if (!value || keywords.has(value) || isProtected(from, protectedRanges)) {
      continue;
    }

    tokens.push({ from, to: from + value.length, kind: "function" });
  }
}

export function highlightCodeTokens(code: string, language: unknown): EditorCodeToken[] {
  const normalizedLanguage = normalizeEditorCodeLanguage(language);
  const cacheKey = cachedTokenKey(code, normalizedLanguage);
  const cachedTokens = tokenCache.get(cacheKey);
  if (cachedTokens) {
    rememberTokens(cacheKey, cachedTokens);
    return cloneTokens(cachedTokens);
  }

  const tokens: EditorCodeToken[] = [];
  const lines = code.split("\n");
  let offset = 0;

  for (const line of lines) {
    const protectedRanges: ProtectedRange[] = [];
    scanProtectedTokens(line, offset, normalizedLanguage, tokens, protectedRanges);

    if (normalizedLanguage === "markdown") {
      scanMarkdownTokens(line, offset, protectedRanges, tokens);
    }

    const keywordRegex = keywordRegexFor(normalizedLanguage);
    if (keywordRegex) {
      scanRegexTokens(line, offset, protectedRanges, keywordRegex, "keyword", tokens);
    }

    scanRegexTokens(
      line,
      offset,
      protectedRanges,
      /\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b/g,
      "number",
      tokens,
    );
    scanFunctionTokens(line, offset, normalizedLanguage, protectedRanges, tokens);

    offset += line.length + 1;
  }

  const sortedTokens = tokens.sort((left, right) => left.from - right.from || left.to - right.to);
  rememberTokens(cacheKey, sortedTokens);
  return cloneTokens(sortedTokens);
}

export function codeLineDecorations(
  code: string,
  attrs: CodeLineDecorationAttrs,
): EditorCodeLineDecoration[] {
  const lines = code.split("\n");
  const highlightIndexes = highlightedLineIndexes(attrs.highlightLines, lines.length);
  const additionIndexes = highlightedLineIndexes(attrs.additionLines, lines.length);
  const deletionIndexes = highlightedLineIndexes(attrs.deletionLines, lines.length);

  if (highlightIndexes.size === 0 && additionIndexes.size === 0 && deletionIndexes.size === 0) {
    return [];
  }

  const decorations: EditorCodeLineDecoration[] = [];
  let offset = 0;

  lines.forEach((line, index) => {
    const kind: EditorCodeLineDecorationKind | undefined = deletionIndexes.has(index)
      ? "deletion"
      : additionIndexes.has(index)
        ? "addition"
        : highlightIndexes.has(index)
          ? "highlight"
          : undefined;

    if (kind) {
      const lineEnd = offset + line.length;
      decorations.push(
        lineEnd > offset
          ? { from: offset, to: lineEnd, kind }
          : { from: offset, to: offset, kind, empty: true },
      );
    }

    offset += line.length + 1;
  });

  return decorations;
}

function codeLineDecorationElement(kind: EditorCodeLineDecorationKind): HTMLElement {
  const marker = document.createElement("span");
  marker.className = `dc-code-line dc-code-line-${kind}`;
  marker.setAttribute("aria-hidden", "true");
  return marker;
}

function codeBlockDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = [];

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "codeBlock") {
      return;
    }

    for (const lineDecoration of codeLineDecorations(node.textContent, node.attrs)) {
      decorations.push(
        Decoration.widget(
          pos + 1 + lineDecoration.from,
          () => codeLineDecorationElement(lineDecoration.kind),
          { side: -1 },
        ),
      );
    }

    for (const token of highlightCodeTokens(node.textContent, node.attrs.language)) {
      decorations.push(
        Decoration.inline(pos + 1 + token.from, pos + 1 + token.to, {
          class: `dc-code-token dc-code-token-${token.kind}`,
        }),
      );
    }
  });

  return DecorationSet.create(state.doc, decorations);
}

export function createCodeBlockHighlightPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: codeBlockHighlightPluginKey,
    state: {
      init: (_, state) => codeBlockDecorations(state),
      apply: (transaction, decorationSet, _oldState, newState) =>
        transaction.docChanged
          ? codeBlockDecorations(newState)
          : decorationSet.map(transaction.mapping, transaction.doc),
    },
    props: {
      decorations(state) {
        return codeBlockHighlightPluginKey.getState(state);
      },
    },
  });
}
