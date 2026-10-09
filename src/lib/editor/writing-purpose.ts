import { Extension } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";

export const maxWritingPurposeLength = 500;

export function normalizeWritingPurpose(value: unknown): string | null {
  if (typeof value !== "string" || value.length > maxWritingPurposeLength) return null;
  if (
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
    })
  )
    return null;
  return value.trim().replace(/\s+/g, " ");
}

export const WritingPurposeAttributes = Extension.create({
  name: "writingPurposeAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["doc"],
        attributes: {
          writingPurpose: {
            default: "",
            rendered: false,
            validate(value: unknown) {
              if (normalizeWritingPurpose(value) === null)
                throw new RangeError("Invalid writing purpose");
            },
          },
        },
      },
    ];
  },
});

export function createWritingPurposeTransaction(
  state: EditorState,
  input: unknown,
  expectedValue: string,
): { value: string; transaction?: Transaction } | { error: string; conflict?: boolean } {
  const value = normalizeWritingPurpose(input);
  if (value === null) return { error: "이 글의 목적은 500자 이내로 적어 주세요." };
  const current = normalizeWritingPurpose(state.doc.attrs.writingPurpose) ?? "";
  if (current !== expectedValue)
    return {
      error: "다른 곳에서 목적이 바뀌었습니다. 현재 목적을 불러온 뒤 다시 적어 주세요.",
      conflict: true,
    };
  if (current === value) return { value };
  return { value, transaction: closeHistory(state.tr).setDocAttribute("writingPurpose", value) };
}
