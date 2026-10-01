import { localizePath } from "../i18n/locales";
import { getActiveLocale } from "../i18n/strings";

/**
 * Redirects legacy hash routes from the old SPA to the new static paths.
 * Returns true if a redirect was triggered.
 */
export function redirectLegacyHash(): boolean {
  const hash = location.hash.replace(/^#/, "");
  if (!hash || hash === "/") return false;

  const [path, query = ""] = hash.split("?");
  const base = import.meta.env.BASE_URL;
  const locale = getActiveLocale();

  if (path === "/legal") {
    location.replace(`${base}${localizePath("terms-privacy/", locale)}`);
    return true;
  }

  const play = path.match(/^\/play\/([\w-]+)$/);
  if (play) {
    const q = query ? `?${query}` : "";
    location.replace(`${base}${localizePath(`games/${play[1]}/`, locale)}${q}`);
    return true;
  }

  // Unknown old hash → home (same locale as current path)
  if (path.startsWith("/")) {
    location.replace(`${base}${localizePath("", locale)}`);
    return true;
  }

  return false;
}
