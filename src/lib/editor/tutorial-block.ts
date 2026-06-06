import type { JSONContent } from "@tiptap/core";

const defaultTutorialSteps = [
  {
    title: "입력 규모 확인",
    body: "입력 개수, 반복 횟수, 출력 횟수를 먼저 적어 두면 병목이 어디서 날지 훨씬 빨리 보인다.",
  },
  {
    title: "입출력 계열 고정",
    body: "한 글 안에서는 cin/cout 또는 scanf/printf 중 하나로 밀고 가야 순서 꼬임을 줄일 수 있다.",
  },
  {
    title: "최소 코드로 검증",
    body: "최적화 코드를 넣기 전에 기본 코드로 맞추고, 시간이 튀는 지점만 좁혀 본다.",
  },
] as const;

export function createDefaultTutorialBlock(): JSONContent {
  return {
    type: "tutorialBlock",
    content: defaultTutorialSteps.map((step) => createTutorialStep(step.title, step.body)),
  };
}

function createTutorialStep(title: string, body?: string): JSONContent {
  const trimmedBody = body?.trim();

  return {
    type: "tutorialStep",
    attrs: { title },
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

function cleanTutorialLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d{1,2}[.)]\s+/, "")
    .replace(/^0?\d{1,2}\s+/, "")
    .trim();
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
    .filter((line) => line.length > 0)
    .map((line) => {
      const step = splitTutorialLine(line);
      return createTutorialStep(step.title, step.body);
    });

  return steps.length > 0
    ? {
        type: "tutorialBlock",
        content: steps,
      }
    : undefined;
}
