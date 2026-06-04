export const supportedLanguages = [
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "svelte", label: "Svelte" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "php", label: "PHP" },
  { id: "json", label: "JSON" },
  { id: "bash", label: "Bash" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "haskell", label: "Haskell" },
  { id: "scala", label: "Scala" },
  { id: "zig", label: "Zig" },
  { id: "julia", label: "Julia" },
  { id: "mojo", label: "Mojo" },
] as const satisfies readonly { id: string; label: string }[];

export const supportedThemes = [
  { id: "github-dark", label: "GitHub Dark" },
  { id: "github-light", label: "GitHub Light" },
  { id: "vitesse-dark", label: "Vitesse Dark" },
  { id: "min-light", label: "Min Light" },
  { id: "dracula", label: "Dracula" },
  { id: "one-dark-pro", label: "One Dark Pro" },
] as const satisfies readonly { id: string; label: string }[];

export type DcLanguageId = (typeof supportedLanguages)[number]["id"];
export type DcThemeId = (typeof supportedThemes)[number]["id"];

export const defaultLanguage: DcLanguageId = "cpp";
export const defaultTheme: DcThemeId = "github-dark";

export function isSupportedLanguage(value: string): value is DcLanguageId {
  return supportedLanguages.some((language) => language.id === value);
}
