import type { JSONContent } from "@tiptap/core";

const defaultTutorialSteps = [
  {
    title: "작업 단위 쪼개기",
    body: "함수 앞에 go를 붙여 독립적으로 돌릴 수 있는 일을 먼저 분리한다.",
  },
  {
    title: "채널로 값 전달",
    body: "공유 변수보다 channel을 통해 값이 이동하는 방향을 코드에 드러낸다.",
  },
  {
    title: "닫는 쪽 정하기",
    body: "송신자가 작업을 끝낸 뒤 close로 종료 신호를 주는 구조를 명확히 한다.",
  },
  {
    title: "취소 경로 연결",
    body: "context를 넘겨 요청 취소와 타임아웃이 모든 고루틴에 전파되게 한다.",
  },
] as const;

export function createDefaultTutorialBlock(): JSONContent {
  return {
    type: "tutorialBlock",
    content: defaultTutorialSteps.map((step, index) =>
      createTutorialStep(step.title, step.body, index + 1),
    ),
  };
}

export function normalizeTutorialStepNumber(value: unknown, fallback?: number): string {
  const raw = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  const compact = raw.replace(/\s+/g, "");

  if (/^\d{1,3}$/.test(compact)) {
    return compact.padStart(2, "0");
  }

  if (compact) {
    return compact.slice(0, 8);
  }

  return typeof fallback === "number" && Number.isFinite(fallback)
    ? String(Math.max(1, Math.floor(fallback))).padStart(2, "0")
    : "";
}

export function createTutorialStep(
  title: string,
  body?: string,
  number?: string | number,
): JSONContent {
  const trimmedBody = body?.trim();
  const normalizedNumber = normalizeTutorialStepNumber(number);

  return {
    type: "tutorialStep",
    attrs: {
      title,
      ...(normalizedNumber ? { number: normalizedNumber } : {}),
    },
    content: trimmedBody
      ? [
          {
            type: "paragraph",
            content: [{ type: "text", text: trimmedBody }],
          },
        ]
      : [],
  };
}

function parseTutorialLineNumber(line: string): { number?: string; text: string } {
  const trimmed = line.trim().replace(/^[-*+]\s+/, "");
  const numbered = /^(\d{1,3})(?:[.)]|\s+)\s*(.*)$/.exec(trimmed);

  if (numbered) {
    return {
      number: normalizeTutorialStepNumber(numbered[1]),
      text: numbered[2]?.trim() ?? "",
    };
  }

  return { text: trimmed };
}

function cleanTutorialLine(line: string): { number?: string; text: string } {
  return line
    ? parseTutorialLineNumber(line)
    : { text: "" };
}

function splitTutorialLine(line: string): { title: string; body?: string } {
  const separators = ["::", " - ", " — ", " – ", ": "];

  for (const separator of separators) {
    const index = line.indexOf(separator);

    if (index > 0) {
      const title = line.slice(0, index).trim();
      const body = line.slice(index + separator.length).trim();

      if (title && body) {
        return { title, body };
      }
    }
  }

  return { title: line };
}

export function createTutorialBlockFromText(text: string): JSONContent | undefined {
  const steps = text
    .split(/\r?\n/)
    .map(cleanTutorialLine)
    .filter((line) => line.text.length > 0)
    .map((line, index) => {
      const step = splitTutorialLine(line.text);
      return createTutorialStep(step.title, step.body, line.number ?? index + 1);
    });

  return steps.length > 0
    ? {
        type: "tutorialBlock",
        content: steps,
      }
    : undefined;
}
