/** Locale registry — enable/disable languages here; the build and UI follow this config. */

export interface LocaleDef {
  /** When false, pages are not built and the language is omitted from hreflang / the picker. */
  enabled: boolean;
  /** URL path segment after the site root (`""` for default, `"ua"` for Ukrainian). */
  pathPrefix: string;
  /** `<html lang="…">` value (BCP 47). */
  htmlLang: string;
  /** `hreflang` attribute value (BCP 47). Ukrainian uses `uk`, not `ua`. */
  hreflang: string;
  /** Language name in that language, shown in the picker (no flags). */
  nativeName: string;
  /** Default / x-default locale (English at `/`). */
  isDefault: boolean;
}

export const LOCALES = {
  en: {
    enabled: true,
    pathPrefix: "",
    htmlLang: "en",
    hreflang: "en",
    nativeName: "English",
    isDefault: true,
  },
  ua: {
    enabled: true,
    pathPrefix: "ua",
    htmlLang: "uk",
    hreflang: "uk",
    nativeName: "Українська",
    isDefault: false,
  },
} as const satisfies Record<string, LocaleDef>;

export type LocaleCode = keyof typeof LOCALES;

export function enabledLocales(): { code: LocaleCode; def: (typeof LOCALES)[LocaleCode] }[] {
  return (Object.keys(LOCALES) as LocaleCode[])
    .filter((code) => LOCALES[code].enabled)
    .map((code) => ({ code, def: LOCALES[code] }));
}

export function defaultLocale(): LocaleCode {
  const found = (Object.keys(LOCALES) as LocaleCode[]).find((c) => LOCALES[c].isDefault && LOCALES[c].enabled);
  return found ?? "en";
}

/** Picker entries sorted alphabetically by native name. */
export function pickerLocales(): { code: LocaleCode; nativeName: string }[] {
  return enabledLocales()
    .map(({ code, def }) => ({ code, nativeName: def.nativeName }))
    .sort((a, b) => a.nativeName.localeCompare(b.nativeName, "en"));
}

export function showLanguagePicker(): boolean {
  return enabledLocales().length > 1;
}

/**
 * Detect locale from a pathname (Vite base stripped by the caller if needed).
 * `/ua/about/` → `ua`; `/about/` → default.
 */
export function localeFromPath(pathname: string): LocaleCode {
  const parts = pathname.replace(/\\/g, "/").split("/").filter(Boolean);
  // Skip empty; first segment may be a locale prefix.
  const first = parts[0];
  if (first && first in LOCALES) {
    const code = first as LocaleCode;
    if (LOCALES[code].enabled && LOCALES[code].pathPrefix === first) return code;
  }
  return defaultLocale();
}

/** Strip a leading locale prefix from a site-relative path (`ua/about/` → `about/`). */
export function stripLocalePrefix(pathPart: string): string {
  const clean = pathPart.replace(/^\//, "");
  const locale = localeFromPath(`/${clean}`);
  const prefix = LOCALES[locale].pathPrefix;
  if (!prefix) return clean;
  if (clean === prefix || clean === `${prefix}/`) return "";
  if (clean.startsWith(`${prefix}/`)) return clean.slice(prefix.length + 1);
  return clean;
}

/**
 * Build a site-relative path for a locale.
 * `localizePath("about/", "ua")` → `ua/about/`; `localizePath("about/", "en")` → `about/`.
 */
export function localizePath(pathPart: string, locale: LocaleCode): string {
  const logical = stripLocalePrefix(pathPart).replace(/^\//, "");
  const prefix = LOCALES[locale].pathPrefix;
  if (!prefix) return logical;
  return logical ? `${prefix}/${logical}` : `${prefix}/`;
}

/** Absolute URL for a logical path in a locale (no leading slash on pathPart, or with). */
export function absoluteLocaleUrl(origin: string, pathPart: string, locale: LocaleCode): string {
  const localized = localizePath(pathPart, locale).replace(/^\//, "");
  return localized ? `${origin}/${localized}` : `${origin}/`;
}
