type SupportedLanguage = {
  readonly id: string;
  readonly label: string;
  readonly group: SupportedLanguageGroupId;
  readonly shikiLanguage?: string;
};

type SupportedLanguageGroupId = "native" | "web" | "data" | "diff" | "script" | "general";

export const supportedLanguageGroupLabels = {
  native: "시스템/네이티브",
  web: "웹/프론트엔드",
  data: "데이터/설정",
  diff: "변경/패치",
  script: "스크립트",
  general: "일반 언어",
} as const satisfies Record<SupportedLanguageGroupId, string>;

export const supportedLanguages = [
  { id: "c", label: "C", group: "native" },
  { id: "cpp", label: "C++", group: "native" },
  { id: "csharp", label: "C#", group: "native" },
  { id: "asm", label: "Assembly", group: "native" },
  { id: "rust", label: "Rust", group: "native" },
  { id: "zig", label: "Zig", group: "native" },
  { id: "javascript", label: "JavaScript", group: "web" },
  { id: "typescript", label: "TypeScript", group: "web" },
  { id: "jsx", label: "React JSX", group: "web" },
  { id: "tsx", label: "React TSX", group: "web" },
  { id: "svelte", label: "Svelte", group: "web" },
  { id: "astro", label: "Astro", group: "web" },
  { id: "html", label: "HTML", group: "web" },
  { id: "css", label: "CSS", group: "web" },
  { id: "tailwind", label: "Tailwind CSS", group: "web", shikiLanguage: "html" },
  { id: "unocss", label: "UnoCSS", group: "web", shikiLanguage: "html" },
  { id: "php", label: "PHP", group: "web" },
  { id: "json", label: "JSON", group: "data" },
  { id: "yaml", label: "YAML", group: "data" },
  { id: "toml", label: "TOML", group: "data" },
  { id: "sql", label: "SQL", group: "data" },
  { id: "diff", label: "Diff", group: "diff" },
  { id: "patch", label: "Patch", group: "diff", shikiLanguage: "diff" },
  { id: "bash", label: "Bash", group: "script" },
  { id: "python", label: "Python", group: "script" },
  { id: "java", label: "Java", group: "general" },
  { id: "go", label: "Go", group: "general" },
  { id: "haskell", label: "Haskell", group: "general" },
  { id: "scala", label: "Scala", group: "general" },
  { id: "julia", label: "Julia", group: "general" },
  { id: "mojo", label: "Mojo", group: "general" },
] as const satisfies readonly SupportedLanguage[];

export const supportedLanguageGroups = Object.entries(supportedLanguageGroupLabels)
  .map(([id, label]) => ({
    id: id as SupportedLanguageGroupId,
    label,
    languages: supportedLanguages.filter((language) => language.group === id),
  }))
  .filter((group) => group.languages.length > 0);

export const supportedThemes = [
  { id: "github-dark", label: "GitHub Dark" },
  { id: "github-light", label: "GitHub Light" },
  { id: "github-dark-dimmed", label: "GitHub Dark Dimmed" },
  { id: "github-dark-high-contrast", label: "GitHub Dark Contrast" },
  { id: "github-light-high-contrast", label: "GitHub Light Contrast" },
  { id: "vitesse-dark", label: "Vitesse Dark" },
  { id: "vitesse-light", label: "Vitesse Light" },
  { id: "vitesse-black", label: "Vitesse Black" },
  { id: "min-light", label: "Min Light" },
  { id: "min-dark", label: "Min Dark" },
  { id: "dracula", label: "Dracula" },
  { id: "dracula-soft", label: "Dracula Soft" },
  { id: "one-dark-pro", label: "One Dark Pro" },
  { id: "one-light", label: "One Light" },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha" },
  { id: "catppuccin-macchiato", label: "Catppuccin Macchiato" },
  { id: "catppuccin-frappe", label: "Catppuccin Frappe" },
  { id: "catppuccin-latte", label: "Catppuccin Latte" },
  { id: "tokyo-night", label: "Tokyo Night" },
  { id: "night-owl", label: "Night Owl" },
  { id: "night-owl-light", label: "Night Owl Light" },
  { id: "nord", label: "Nord" },
  { id: "kanagawa-wave", label: "Kanagawa Wave" },
  { id: "kanagawa-dragon", label: "Kanagawa Dragon" },
  { id: "kanagawa-lotus", label: "Kanagawa Lotus" },
  { id: "rose-pine", label: "Rose Pine" },
  { id: "rose-pine-moon", label: "Rose Pine Moon" },
  { id: "rose-pine-dawn", label: "Rose Pine Dawn" },
  { id: "gruvbox-dark-medium", label: "Gruvbox Dark" },
  { id: "gruvbox-light-medium", label: "Gruvbox Light" },
  { id: "solarized-dark", label: "Solarized Dark" },
  { id: "solarized-light", label: "Solarized Light" },
  { id: "monokai", label: "Monokai" },
  { id: "material-theme-palenight", label: "Material Palenight" },
  { id: "dark-plus", label: "VS Code Dark+" },
  { id: "light-plus", label: "VS Code Light+" },
] as const satisfies readonly { id: string; label: string }[];

export type DcLanguageId = (typeof supportedLanguages)[number]["id"];
export type DcThemeId = (typeof supportedThemes)[number]["id"];

export const defaultLanguage: DcLanguageId = "cpp";
export const defaultTheme: DcThemeId = "catppuccin-mocha";

export function isSupportedLanguage(value: string): value is DcLanguageId {
  return supportedLanguages.some((language) => language.id === value);
}

export function isSupportedTheme(value: string): value is DcThemeId {
  return supportedThemes.some((theme) => theme.id === value);
}

export function shikiLanguageFor(language: DcLanguageId): string {
  const selected: SupportedLanguage | undefined = supportedLanguages.find(
    (item) => item.id === language,
  );
  return selected?.shikiLanguage ?? language;
}
