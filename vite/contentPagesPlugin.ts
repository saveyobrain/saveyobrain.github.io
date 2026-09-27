import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import type { Plugin } from "vite";
import { renderDocument } from "./siteChrome.ts";

const SITE_NAME = "Save Yo Brain";
const SUPPORT_URL = "https://buymeacoffee.com/saveyobrain";
const DEFAULT_DESCRIPTION =
  "Free browser games that help kids and grown-ups build and keep their math skills.";

interface PageDef {
  /** Markdown file under content/, or null for a hand-built page. */
  md?: string;
  /** Output HTML path relative to project root. */
  out: string;
  /** Path used for nav active state, trailing slash except home. */
  currentPath: string;
  mainClass?: string;
  bodyClass?: string;
  /** Override script (absolute from site root or /src/...). */
  scriptSrc?: string;
  /** Build main HTML without markdown (e.g. 404). */
  mainHtml?: string;
  title?: string;
  description?: string;
}

const PAGES: PageDef[] = [
  {
    md: "about.md",
    out: "about/index.html",
    currentPath: "about/",
  },
  {
    md: "feedback.md",
    out: "feedback/index.html",
    currentPath: "feedback/",
  },
  {
    md: "terms-privacy.md",
    out: "terms-privacy/index.html",
    currentPath: "terms-privacy/",
    mainClass: "site-main content-page legal",
  },
  {
    out: "404.html",
    currentPath: "",
    title: `Page not found - ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    mainClass: "site-main content-page",
    mainHtml: `<h1>Page not found</h1>
<p>That page does not exist. Head back home and pick a game.</p>
<p><a class="btn btn-primary" href="__HOME__">Back to home</a></p>`,
  },
];

function writePages(root: string, base: string): string[] {
  const contentDir = path.join(root, "content");
  const written: string[] = [];

  for (const page of PAGES) {
    let title = page.title ?? SITE_NAME;
    let description = page.description ?? DEFAULT_DESCRIPTION;
    let mainHtml = page.mainHtml ?? "";
    let embedHtml = "";

    if (page.md) {
      const raw = fs.readFileSync(path.join(contentDir, page.md), "utf8");
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

    mainHtml = mainHtml.replaceAll("__HOME__", baseUrl(base, ""));
    if (embedHtml) mainHtml += embedHtml;

    const html = renderDocument({
      base,
      siteName: SITE_NAME,
      supportUrl: SUPPORT_URL,
      currentPath: page.currentPath,
      title,
      description,
      mainHtml,
      mainClass: page.mainClass ?? "site-main content-page",
      bodyClass: page.bodyClass,
      scriptSrc: page.scriptSrc,
    });

    const outPath = path.join(root, page.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    written.push(outPath);
  }

  return written;
}

function baseUrl(base: string, pathPart: string): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}${pathPart.replace(/^\//, "")}`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Generates static HTML pages from `content/*.md` before Vite builds or serves. */
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
  return {
    about: path.join(root, "about/index.html"),
    feedback: path.join(root, "feedback/index.html"),
    "terms-privacy": path.join(root, "terms-privacy/index.html"),
    notFound: path.join(root, "404.html"),
  };
}
