import { SUPPORT_URL } from "../../config";
import { strings } from "../../strings";
import { h } from "./dom";

/** "Support the project" link (Buy Me a Coffee); the label shortens on narrow screens. */
export function supportLink(extraClass = ""): HTMLAnchorElement {
  return h(
    "a",
    {
      class: `btn btn-support ${extraClass}`.trim(),
      href: SUPPORT_URL,
      target: "_blank",
      rel: "noopener noreferrer",
      title: strings.support,
    },
    h("span", { class: "btn-support-icon", "aria-hidden": "true" }, "\u2615\uFE0F"),
    h("span", { class: "btn-support-label" }, strings.support),
    h("span", { class: "btn-support-short" }, strings.supportShort),
  );
}
