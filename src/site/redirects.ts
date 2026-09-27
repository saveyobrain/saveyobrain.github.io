/**
 * Redirects legacy hash routes from the old SPA to the new static paths.
 * Returns true if a redirect was triggered.
 */
export function redirectLegacyHash(): boolean {
  const hash = location.hash.replace(/^#/, "");
  if (!hash || hash === "/") return false;

  const [path, query = ""] = hash.split("?");
  const base = import.meta.env.BASE_URL;

  if (path === "/legal") {
    location.replace(`${base}terms-privacy/`);
    return true;
  }

  const play = path.match(/^\/play\/([\w-]+)$/);
  if (play) {
    const q = query ? `?${query}` : "";
    location.replace(`${base}games/${play[1]}/${q}`);
    return true;
  }

  // Unknown old hash → home
  if (path.startsWith("/")) {
    location.replace(base);
    return true;
  }

  return false;
}
