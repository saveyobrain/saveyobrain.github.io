import { h } from "../core/ui/dom";
import { legal, type LegalSection } from "../legal";
import { strings } from "../strings";

function sections(list: LegalSection[]): HTMLElement[] {
  return list.map((s) => h("section", {}, h("h3", {}, s.heading), ...s.paragraphs.map((p) => h("p", {}, p))));
}

export function renderLegal(root: HTMLElement): void {
  root.replaceChildren(
    h(
      "main",
      { class: "legal" },
      h("a", { class: "btn btn-link legal-back", href: "#/" }, `\u2190 ${strings.backToGames}`),
      h("h1", {}, legal.title),
      h("p", { class: "legal-updated" }, legal.updated),
      h("p", {}, legal.intro),
      h("h2", { id: "terms" }, "Terms of Use"),
      ...sections(legal.terms),
      h("h2", { id: "privacy" }, "Privacy Policy"),
      ...sections(legal.privacy),
      h(
        "p",
        { class: "legal-contact" },
        h("a", { href: legal.contactUrl, target: "_blank", rel: "noopener noreferrer" }, legal.contactLabel),
        ".",
      ),
    ),
  );
}
