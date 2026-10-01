import { defaultLocale, localeFromPath, type LocaleCode } from "../locales";
import { en } from "./en";
import type { Strings } from "./types";
import { ua } from "./ua";

const TABLES: Record<LocaleCode, Strings> = { en, ua };

let active: LocaleCode = defaultLocale();

export function setActiveLocale(code: LocaleCode): void {
  active = TABLES[code] ? code : defaultLocale();
}

export function getActiveLocale(): LocaleCode {
  return active;
}

export function getStrings(locale: LocaleCode = active): Strings {
  return TABLES[locale] ?? TABLES[defaultLocale()];
}

/** Call once on page boot from `location.pathname` (after stripping Vite base if needed). */
export function initLocaleFromLocation(pathname = location.pathname): LocaleCode {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "";
  let path = pathname;
  if (base && path.startsWith(base)) path = path.slice(base.length) || "/";
  const code = localeFromPath(path);
  setActiveLocale(code);
  return code;
}

export type { Strings };
