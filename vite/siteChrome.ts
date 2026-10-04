/** Shared header/footer HTML for static pages (used by the Vite content plugin). */

import {
  absoluteLocaleUrl,
  defaultLocale,
  enabledLocales,
  LOCALES,
  localizePath,
  pickerLocales,
  showLanguagePicker,
  stripLocalePrefix,
  type LocaleCode,
} from "../src/i18n/locales.ts";
import { getStrings } from "../src/i18n/strings/index.ts";

export interface ChromeOptions {
  /** Vite `base` with trailing slash, e.g. `/` or `/saveyobrain/`. */
  base: string;
  siteName: string;
  /** Logical path without locale prefix, e.g. `about/` or `` for home. */
  currentPath: string;
  locale: LocaleCode;
  /** Extra class on `<body>`. */
  bodyClass?: string;
}

function url(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const b = base.endsWith("/") ? base : `${base}/`;
  const p = path.replace(/^\//, "");
  return `${b}${p}`;
}

function localeHref(base: string, locale: LocaleCode, logicalPath: string): string {
  return url(base, localizePath(logicalPath, locale));
}

function navItem(
  base: string,
  locale: LocaleCode,
  logicalCurrent: string,
  logicalHref: string,
  label: string,
): string {
  const full = localeHref(base, locale, logicalHref);
  const active =
    (logicalHref === "" && logicalCurrent === "") ||
    (logicalHref !== "" && logicalCurrent === logicalHref.replace(/\/$/, "") + "/");
  const cls = active ? ' class="is-active"' : "";
  return `<a href="${full}"${cls}>${escapeHtml(label)}</a>`;
}

const GLOBE_SVG = `<svg class="lang-globe-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" fill="none" stroke="currentColor" stroke-width="1.75"/></svg>`;

function renderLangPicker(base: string, locale: LocaleCode, logicalPath: string, labels: { language: string }): string {
  if (!showLanguagePicker()) return "";
  const options = pickerLocales()
    .map(({ code, nativeName }) => {
      const href = localeHref(base, code, logicalPath);
      const selected = code === locale ? ' aria-current="true" class="is-current"' : "";
      return `<a href="${href}" role="menuitem"${selected} data-locale="${code}">${escapeHtml(nativeName)}</a>`;
    })
    .join("");

  return `
<div class="lang-picker">
  <button type="button" class="lang-toggle" aria-expanded="false" aria-haspopup="true" aria-label="${escapeAttr(labels.language)}" title="${escapeAttr(labels.language)}">
    ${GLOBE_SVG}
    <span class="lang-toggle-label">${escapeHtml(labels.language)}</span>
  </button>
  <div class="lang-menu" role="menu" hidden>
    ${options}
  </div>
</div>`.trim();
}

/** Favicon + PWA icon links for document heads. */
export function renderIconLinks(base: string): string {
  return [
    `<link rel="icon" href="${url(base, "favicon.ico")}" sizes="any" />`,
    `<link rel="icon" href="${url(base, "favicon.svg")}" type="image/svg+xml" />`,
    `<link rel="icon" href="${url(base, "favicon-96x96.png")}" type="image/png" sizes="96x96" />`,
    `<link rel="apple-touch-icon" href="${url(base, "apple-touch-icon.png")}" />`,
    `<link rel="manifest" href="${url(base, "site.webmanifest")}" />`,
  ].join("\n    ");
}

/** `rel=alternate` hreflang tags for enabled locales + x-default. */
export function renderHreflangLinks(logicalPath: string): string {
  const def = defaultLocale();
  const tags = enabledLocales().map(({ code, def: localeDef }) => {
    const href = absoluteLocaleUrl(SITE_ORIGIN, logicalPath, code);
    return `<link rel="alternate" hreflang="${escapeAttr(localeDef.hreflang)}" href="${escapeAttr(href)}" />`;
  });
  tags.push(
    `<link rel="alternate" hreflang="x-default" href="${escapeAttr(absoluteLocaleUrl(SITE_ORIGIN, logicalPath, def))}" />`,
  );
  return tags.join("\n    ");
}

export function renderHeader(opts: ChromeOptions): string {
  const { base, siteName, currentPath, locale } = opts;
  const s = getStrings(locale);
  const home = localeHref(base, locale, "");
  const logo = url(base, "logo.png");
  const logical = stripLocalePrefix(currentPath);
  const picker = renderLangPicker(base, locale, logical, { language: s.chrome.language });

  return `
<header class="site-header">
  <a class="site-brand" href="${home}">
    <img class="site-logo" src="${logo}" width="34" height="40" alt="" />
    <span class="site-brand-text">${escapeHtml(siteName)}</span>
  </a>
  <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="${escapeAttr(s.chrome.menuAria)}">
    <span class="nav-toggle-bars" aria-hidden="true"></span>
  </button>
  <nav id="site-nav" class="site-nav">
    ${navItem(base, locale, logical, "about/", s.chrome.about)}
    ${navItem(base, locale, logical, "feedback/", s.chrome.feedback)}
    ${picker}
  </nav>
</header>`.trim();
}

export function renderFooter(opts: ChromeOptions): string {
  const logical = stripLocalePrefix(opts.currentPath);
  if (logical === "terms-privacy/") return "";
  const s = getStrings(opts.locale);
  const terms = localeHref(opts.base, opts.locale, "terms-privacy/");
  return `
<footer class="site-footer">
  <a href="${terms}">${escapeHtml(s.chrome.termsPrivacy)}</a>
</footer>`.trim();
}

export function renderDocument(
  opts: ChromeOptions & {
    title: string;
    description: string;
    mainHtml: string;
    mainClass?: string;
    scriptSrc?: string;
    /** Absolute canonical URL; defaults to SITE_ORIGIN + localized path. Pass `null` to omit (e.g. 404). */
    canonicalUrl?: string | null;
    /** Logical path for hreflang (defaults to currentPath stripped of locale). */
    hreflangPath?: string | null;
  },
): string {
  const { base, title, description, mainHtml, mainClass = "site-main", scriptSrc, bodyClass = "", locale } = opts;
  const logical = stripLocalePrefix(opts.currentPath);
  const script = scriptSrc
    ? `<script type="module" src="${scriptSrc.startsWith("/") || scriptSrc.startsWith(".") ? scriptSrc : url(base, scriptSrc)}"></script>`
    : `<script type="module" src="${url(base, "src/site/nav-entry.ts")}"></script>`;
  const canonical =
    opts.canonicalUrl === null
      ? null
      : (opts.canonicalUrl ?? absoluteLocaleUrl(SITE_ORIGIN, logical, locale));
  const canonicalTag = canonical
    ? `\n    <link rel="canonical" href="${escapeAttr(canonical)}" />`
    : "";
  const hreflangPath = opts.hreflangPath === null ? null : (opts.hreflangPath ?? logical);
  const hreflangTags =
    hreflangPath === null ? "" : `\n    ${renderHreflangLinks(hreflangPath)}`;

  return `<!doctype html>
<html lang="${escapeAttr(LOCALES[locale].htmlLang)}">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(description)}" />${canonicalTag}${hreflangTags}
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#fff4dc" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:type" content="website" />
    ${renderIconLinks(base)}
    <script
      defer
      src="https://cloud.umami.is/script.js"
      data-website-id="27d41969-25e7-49bb-b973-f1033571809c"
      data-domains="saveyobrain.com"
    ></script>
  </head>
  <body${bodyClass ? ` class="${bodyClass}"` : ""}>
    <div class="site-page">
      ${renderHeader(opts)}
      <main class="${mainClass}">
        ${mainHtml}
      </main>
      ${renderFooter(opts)}
    </div>
    ${script}
  </body>
</html>
`;
}

/** Home page document for a locale (hub shell). */
export function renderHomeDocument(base: string, locale: LocaleCode): string {
  const s = getStrings(locale);
  const gamePath = localeHref(base, locale, "games/save-the-light/");
  const mainHtml = `
        <section class="hub-hero">
          <h1 class="hub-headline">${escapeHtml(s.hubHeadline)}</h1>
          <p class="hub-intro">${escapeHtml(s.hubIntro)}</p>
          <p class="hub-hero-cta">
            <a class="btn btn-primary" href="${gamePath}">${escapeHtml(s.playGame(s.stl.title))}</a>
          </p>
        </section>

        <section id="game-grid" class="game-grid" aria-label="${escapeAttr(s.siteName)}"></section>
        <p class="hub-note">${escapeHtml(s.hubNote)}</p>`;

  return renderDocument({
    base,
    siteName: s.siteName,
    currentPath: localizePath("", locale),
    locale,
    title: s.homeTitle,
    description: s.homeDescription,
    mainHtml,
    mainClass: "site-main hub",
    scriptSrc: "/src/pages/home.ts",
    hreflangPath: "",
  });
}

/** Minimal game shell for a locale. */
export function renderGameDocument(base: string, locale: LocaleCode): string {
  const s = getStrings(locale);
  const title = s.stl.pageTitle;
  const description = s.stl.description;
  const canonical = absoluteLocaleUrl(SITE_ORIGIN, "games/save-the-light/", locale);
  const hreflang = renderHreflangLinks("games/save-the-light/");

  return `<!doctype html>
<html lang="${escapeAttr(LOCALES[locale].htmlLang)}">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    ${hreflang}
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#fff4dc" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:type" content="website" />
    ${renderIconLinks(base)}
    <script
      defer
      src="https://cloud.umami.is/script.js"
      data-website-id="27d41969-25e7-49bb-b973-f1033571809c"
      data-domains="saveyobrain.com"
    ></script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="${url(base, "src/pages/game.ts")}"></script>
  </body>
</html>
`;
}

/** Production origin for canonical URLs (keep in sync with src/config.ts SITE_URL). */
export const SITE_ORIGIN = "https://saveyobrain.com";

/** @deprecated Prefer absoluteLocaleUrl — kept for callers that pass a fully localized path. */
export function canonicalHref(pathPart: string): string {
  const p = pathPart.replace(/^\//, "");
  return p ? `${SITE_ORIGIN}/${p}` : `${SITE_ORIGIN}/`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
