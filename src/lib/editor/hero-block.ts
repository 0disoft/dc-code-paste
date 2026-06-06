import type { JSONContent } from "@tiptap/core";

const defaultHero = {
  label: "CODING GUIDE",
  title: "C++로 보는 입력 최적화",
  subtitle: "입출력 병목을 예제와 비교로 빠르게 잡아내는 강의 노트.",
} as const;

type HeroInput = {
  label: string;
  title: string;
  subtitle: string;
};

export function createDefaultHeroBlock(): JSONContent {
  return createHeroBlock(defaultHero);
}

function createHeroBlock(input: HeroInput): JSONContent {
  return {
    type: "heroBlock",
    attrs: { label: input.label },
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: input.title }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: input.subtitle }],
      },
    ],
  };
}

function cleanHeroLine(line: string): string {
  return line
    .trim()
    .replace(/^#+\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function parseLabelLine(line: string): string | undefined {
  const match = /^(?:label|eyebrow|kicker|라벨|분류|상단)\s*[:：]\s*(.+)$/i.exec(line);
  return match?.[1]?.trim() || undefined;
}

export function createHeroBlockFromText(text: string): JSONContent | undefined {
  const lines = text.split(/\r?\n/).map(cleanHeroLine).filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  const firstLineLabel = parseLabelLine(lines[0]);
  if (firstLineLabel) {
    const title = lines[1]?.trim();

    if (!title) {
      return undefined;
    }

    return createHeroBlock({
      label: firstLineLabel,
      title,
      subtitle: lines.slice(2).join(" ") || defaultHero.subtitle,
    });
  }

  if (lines.length >= 3) {
    return createHeroBlock({
      label: lines[0].replace(/[:：]$/, ""),
      title: lines[1],
      subtitle: lines.slice(2).join(" "),
    });
  }

  return createHeroBlock({
    label: defaultHero.label,
    title: lines[0],
    subtitle: lines.slice(1).join(" ") || defaultHero.subtitle,
  });
}
