/** Shared header/footer HTML for static content pages (used by the Vite content plugin). */

export interface ChromeOptions {
  /** Vite `base` with trailing slash, e.g. `/` or `/saveyobrain/`. */
  base: string;
  siteName: string;
  supportUrl: string;
  /** Path of the current page relative to site root, e.g. `about/` or `` for home. */
  currentPath: string;
  /** Extra class on `<body>`. */
  bodyClass?: string;
}

function url(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const b = base.endsWith("/") ? base : `${base}/`;
  const p = path.replace(/^\//, "");
  return `${b}${p}`;
}

function navItem(base: string, currentPath: string, href: string, label: string, external = false): string {
  const full = url(base, href);
  const active =
    !external &&
    ((href === "" && currentPath === "") || (href !== "" && currentPath === href.replace(/\/$/, "") + "/"));
  const cls = active ? ' class="is-active"' : "";
  const extra = external ? ' target="_blank" rel="noopener noreferrer"' : "";
  return `<a href="${full}"${cls}${extra}>${label}</a>`;
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

export function renderHeader(opts: ChromeOptions): string {
  const { base, siteName, currentPath } = opts;
  const home = url(base, "");
  const logo = url(base, "logo.png");
  // Support the project (header): re-enable with
  // ${navItem(base, currentPath, opts.supportUrl, "Support the project", true)}
  return `
<header class="site-header">
  <a class="site-brand" href="${home}">
    <img class="site-logo" src="${logo}" width="34" height="40" alt="" />
    <span class="site-brand-text">${siteName}</span>
  </a>
  <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">
    <span class="nav-toggle-bars" aria-hidden="true"></span>
  </button>
  <nav id="site-nav" class="site-nav">
    ${navItem(base, currentPath, "about/", "About")}
    ${navItem(base, currentPath, "feedback/", "Feedback")}
  </nav>
</header>`.trim();
}

export function renderFooter(opts: ChromeOptions): string {
  const terms = url(opts.base, "terms-privacy/");
  return `
<footer class="site-footer">
  <a href="${terms}">Terms &amp; Privacy</a>
</footer>`.trim();
}

export function renderDocument(opts: ChromeOptions & {
  title: string;
  description: string;
  mainHtml: string;
  mainClass?: string;
  scriptSrc?: string;
}): string {
  const { base, title, description, mainHtml, mainClass = "site-main", scriptSrc, bodyClass = "" } = opts;
  const script = scriptSrc
    ? `<script type="module" src="${scriptSrc.startsWith("/") || scriptSrc.startsWith(".") ? scriptSrc : url(base, scriptSrc)}"></script>`
    : `<script type="module" src="${url(base, "src/site/nav-entry.ts")}"></script>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="description" content="${escapeAttr(description)}" />
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
    <title>${escapeHtml(title)}</title>
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
