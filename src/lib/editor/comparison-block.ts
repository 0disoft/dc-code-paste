import type { JSONContent } from "@tiptap/core";

type ComparisonSide = "left" | "right";

type ComparisonColumnInput = {
  title: string;
  lines: readonly string[];
};

type MutableComparisonColumnInput = {
  title: string;
  lines: string[];
};

const defaultComparison = {
  left: {
    title: "Before",
    lines: ["공유 슬라이스에 sync.Mutex로 직접 락을 걸면 락 누락과 순서 꼬임을 계속 의심해야 한다."],
  },
  right: {
    title: "After",
    lines: ["버퍼 채널을 작업 큐로 쓰면 값의 이동 방향이 드러나고 경쟁 상태를 줄일 수 있다."],
  },
} as const;

const labelPairs = [
  {
    left: ["before", "이전", "잘못된 코드", "문제", "수정 전"],
    right: ["after", "이후", "수정 코드", "해결", "수정 후"],
  },
  {
    left: ["장점", "좋은 점", "pros", "good"],
    right: ["단점", "나쁜 점", "cons", "bad"],
  },
] as const;

export function createDefaultComparisonBlock(): JSONContent {
  return createComparisonBlock(defaultComparison.left, defaultComparison.right);
}

function createComparisonColumn(side: ComparisonSide, input: ComparisonColumnInput): JSONContent {
  return {
    type: "comparisonColumn",
    attrs: { side, title: input.title },
    content: input.lines.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}

function createComparisonBlock(
  left: ComparisonColumnInput,
  right: ComparisonColumnInput,
): JSONContent {
  return {
    type: "comparisonBlock",
    content: [createComparisonColumn("left", left), createComparisonColumn("right", right)],
  };
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function labelSide(label: string): ComparisonSide | undefined {
  const normalized = normalizeLabel(label);

  for (const pair of labelPairs) {
    if (pair.left.some((candidate) => normalizeLabel(candidate) === normalized)) {
      return "left";
    }

    if (pair.right.some((candidate) => normalizeLabel(candidate) === normalized)) {
      return "right";
    }
  }

  return undefined;
}

function cleanComparisonLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function parseLabelledComparison(lines: string[]): JSONContent | undefined {
  const left: MutableComparisonColumnInput = { title: "Before", lines: [] };
  const right: MutableComparisonColumnInput = { title: "After", lines: [] };
  let currentSide: ComparisonSide | undefined;

  for (const rawLine of lines) {
    const line = cleanComparisonLine(rawLine);

    if (!line) {
      continue;
    }

    const labelledLine = /^([^:：]+)[:：]\s*(.*)$/.exec(line);

    if (labelledLine) {
      const side = labelSide(labelledLine[1]);

      if (side) {
        currentSide = side;
        const target = side === "left" ? left : right;
        target.title = labelledLine[1].trim();

        if (labelledLine[2].trim()) {
          target.lines.push(labelledLine[2].trim());
        }

        continue;
      }
    }

    if (currentSide === "left") {
      left.lines.push(line);
      continue;
    }

    if (currentSide === "right") {
      right.lines.push(line);
    }
  }

  return left.lines.length > 0 && right.lines.length > 0
    ? createComparisonBlock(left, right)
    : undefined;
}

function parseSplitComparison(lines: string[]): JSONContent | undefined {
  const separatorIndex = lines.findIndex((line) => /^-{3,}$/.test(line.trim()));

  if (separatorIndex > 0 && separatorIndex < lines.length - 1) {
    const leftLines = lines.slice(0, separatorIndex).map(cleanComparisonLine).filter(Boolean);
    const rightLines = lines
      .slice(separatorIndex + 1)
      .map(cleanComparisonLine)
      .filter(Boolean);

    if (leftLines.length > 0 && rightLines.length > 0) {
      return createComparisonBlock(
        { title: "Before", lines: leftLines },
        { title: "After", lines: rightLines },
      );
    }
  }

  const cleanLines = lines.map(cleanComparisonLine).filter(Boolean);

  if (cleanLines.length < 2) {
    return undefined;
  }

  const midpoint = Math.ceil(cleanLines.length / 2);
  return createComparisonBlock(
    { title: "Before", lines: cleanLines.slice(0, midpoint) },
    { title: "After", lines: cleanLines.slice(midpoint) },
  );
}

export function createComparisonBlockFromText(text: string): JSONContent | undefined {
  const lines = text.split(/\r?\n/);

  return parseLabelledComparison(lines) ?? parseSplitComparison(lines);
}
