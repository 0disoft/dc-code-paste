import type { JSONContent } from "@tiptap/core";

export const defaultHeroBlockLabel = "";

const sampleHero = {
  label: "GO CONCURRENCY",
  title: "Go 동시성 마스터하기: 고루틴과 채널",
  subtitle: "병렬 처리를 우아하게 구현하는 Go의 동시성 모델을 실전 패턴으로 정리한다.",
} as const;

type HeroInput = {
  label: string;
  title: string;
  subtitle: string;
};

export function createDefaultHeroBlock(): JSONContent {
  return createHeroBlock(sampleHero);
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
      ...(input.subtitle
        ? [{ type: "paragraph", content: [{ type: "text", text: input.subtitle }] }]
        : []),
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
      subtitle: lines.slice(2).join(" "),
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
    label: defaultHeroBlockLabel,
    title: lines[0],
    subtitle: lines.slice(1).join(" "),
  });
}
