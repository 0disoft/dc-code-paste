type SupportedLanguage = {
  readonly id: string;
  readonly label: string;
  readonly shikiLanguage?: string;
};

export const supportedLanguages = [
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "jsx", label: "React JSX" },
  { id: "tsx", label: "React TSX" },
  { id: "svelte", label: "Svelte" },
  { id: "astro", label: "Astro" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "tailwind", label: "Tailwind CSS", shikiLanguage: "html" },
  { id: "unocss", label: "UnoCSS", shikiLanguage: "html" },
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
] as const satisfies readonly SupportedLanguage[];

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
export const defaultTheme: DcThemeId = "github-dark";

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
