import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import type { Plugin } from "vite";
import { enabledLocales, localizePath, type LocaleCode, absoluteLocaleUrl } from "../src/i18n/locales.ts";
import { getStrings } from "../src/i18n/strings/index.ts";
import { renderDocument, renderGameDocument, renderHomeDocument, SITE_ORIGIN } from "./siteChrome.ts";

const SITE_NAME = "Save Yo Brain";

interface PageDef {
  /** Markdown file name under content/<locale>/ */
  md?: string;
  /** Logical path without locale prefix (e.g. about/). */
  logicalPath: string;
  mainClass?: string;
  bodyClass?: string;
  scriptSrc?: string;
  mainHtml?: string;
  title?: string;
  description?: string;
  /** Skip hreflang (404). */
  noHreflang?: boolean;
}

const CONTENT_PAGES: PageDef[] = [
  { md: "about.md", logicalPath: "about/" },
  { md: "feedback.md", logicalPath: "feedback/" },
  { md: "support-the-project.md", logicalPath: "support-the-project/" },
  {
    md: "terms-privacy.md",
    logicalPath: "terms-privacy/",
    mainClass: "site-main content-page legal",
  },
];

function localeRootHref(base: string, locale: LocaleCode): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  const prefix = localizePath("", locale);
  return prefix ? `${b}${prefix}` : b;
}

function rewriteLocalePlaceholders(html: string, base: string, locale: LocaleCode): string {
  const root = localeRootHref(base, locale);
  return html.replaceAll("__LOCALE_ROOT__", root).replaceAll("__HOME__", root);
}

function outPathFor(locale: LocaleCode, logicalPath: string): string {
  const localized = localizePath(logicalPath, locale);
  if (!localized || localized.endsWith("/")) {
    return path.join(localized || "", "index.html");
  }
  return localized;
}

function writePages(root: string, base: string): string[] {
  const written: string[] = [];
  const locales = enabledLocales();

  for (const { code: locale } of locales) {
    // Home
    const homeRel = localizePath("", locale) ? path.join(localizePath("", locale), "index.html") : "index.html";
    const homePath = path.join(root, homeRel);
    fs.mkdirSync(path.dirname(homePath), { recursive: true });
    fs.writeFileSync(homePath, renderHomeDocument(base, locale), "utf8");
    written.push(homePath);

    // Game shell
    const gameRel = path.join(localizePath("games/save-the-light/", locale), "index.html");
    const gamePath = path.join(root, gameRel);
    fs.mkdirSync(path.dirname(gamePath), { recursive: true });
    fs.writeFileSync(gamePath, renderGameDocument(base, locale), "utf8");
    written.push(gamePath);

    for (const page of CONTENT_PAGES) {
      const s = getStrings(locale);
      let title = page.title ?? SITE_NAME;
      let description = page.description ?? s.homeDescription;
      let mainHtml = page.mainHtml ?? "";
      let embedHtml = "";

      if (page.md) {
        const mdPath = path.join(root, "content", locale, page.md);
        if (!fs.existsSync(mdPath)) {
          throw new Error(`Missing content for locale "${locale}": ${mdPath}`);
        }
        const raw = fs.readFileSync(mdPath, "utf8");
        const { data, content } = matter(raw);
        title = String(data.title ?? title);
        if (!title.includes(SITE_NAME)) title = `${title} - ${SITE_NAME}`;
        description = String(data.description ?? description);
        mainHtml = marked.parse(content, { async: false }) as string;
        if (data.embedUrl) {
          const src = escapeAttr(String(data.embedUrl));
          embedHtml = `<div class="embed-frame"><iframe src="${src}" title="${escapeAttr(String(data.embedTitle ?? "Form"))}" loading="lazy"></iframe></div>`;
        }
        if (data.afterEmbed) {
          embedHtml += marked.parse(String(data.afterEmbed), { async: false }) as string;
        }
      }

      mainHtml = rewriteLocalePlaceholders(mainHtml + embedHtml, base, locale);

      const html = renderDocument({
        base,
        siteName: SITE_NAME,
        currentPath: localizePath(page.logicalPath, locale),
        locale,
        canonicalUrl: absoluteLocaleUrl(SITE_ORIGIN, page.logicalPath, locale),
        hreflangPath: page.noHreflang ? null : page.logicalPath,
        title,
        description,
        mainHtml,
        mainClass: page.mainClass ?? "site-main content-page",
        bodyClass: page.bodyClass,
        scriptSrc: page.scriptSrc,
      });

      const rel = outPathFor(locale, page.logicalPath);
      const outFile = path.join(root, rel);
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, html, "utf8");
      written.push(outFile);
    }
  }

  // Single root 404 (English)
  const s = getStrings("en");
  const notFoundHtml = renderDocument({
    base,
    siteName: SITE_NAME,
    currentPath: "",
    locale: "en",
    canonicalUrl: null,
    hreflangPath: null,
    title: s.chrome.notFoundTitle,
    description: s.homeDescription,
    mainClass: "site-main content-page",
    mainHtml: `<h1>${escapeHtml(s.chrome.notFoundHeading)}</h1>
<p>${escapeHtml(s.chrome.notFoundBody)}</p>
<p><a class="btn btn-primary" href="${localeRootHref(base, "en")}">${escapeHtml(s.chrome.notFoundCta)}</a></p>`,
  });
  const notFoundPath = path.join(root, "404.html");
  fs.writeFileSync(notFoundPath, notFoundHtml, "utf8");
  written.push(notFoundPath);

  return written;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Generates static HTML pages from `content/<locale>/*.md` before Vite builds or serves. */
export function contentPagesPlugin(): Plugin {
  let root = process.cwd();
  let base = "/";

  const generate = () => writePages(root, base);

  return {
    name: "content-pages",
    configResolved(config) {
      root = config.root;
      base = config.base;
    },
    buildStart() {
      generate();
    },
    configureServer(server) {
      generate();
      const contentDir = path.join(root, "content");
      server.watcher.add(contentDir);
      server.watcher.on("change", (file) => {
        if (file.startsWith(contentDir) || file.includes(`${path.sep}content${path.sep}`)) {
          generate();
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

export function contentPageInputs(root: string): Record<string, string> {
  const inputs: Record<string, string> = {
    notFound: path.join(root, "404.html"),
  };

  for (const { code: locale } of enabledLocales()) {
    const prefix = localizePath("", locale);
    // EN home + game are listed explicitly in vite.config.ts
    if (locale !== "en") {
      inputs[`home-${locale}`] = path.join(root, prefix, "index.html");
      inputs[`game-${locale}`] = path.join(root, localizePath("games/save-the-light/", locale), "index.html");
    }
    for (const page of CONTENT_PAGES) {
      const rel = outPathFor(locale, page.logicalPath);
      inputs[`${page.logicalPath.replace(/\//g, "-")}-${locale}`] = path.join(root, rel);
    }
  }

  return inputs;
}
