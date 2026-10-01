import { SUPPORT_PAGE_PATH } from "../../config";
import { localizePath } from "../../i18n/locales";
import { getActiveLocale, getStrings } from "../../i18n/strings";
import { h } from "./dom";

/** "Support the project" link to the in-site Support page; the label shortens on narrow screens. */
export function supportLink(extraClass = ""): HTMLAnchorElement {
  const locale = getActiveLocale();
  const strings = getStrings(locale);
  return h(
    "a",
    {
      class: `btn btn-support ${extraClass}`.trim(),
      href: `${import.meta.env.BASE_URL}${localizePath(SUPPORT_PAGE_PATH, locale)}`,
      title: strings.support,
    },
    h("span", { class: "btn-support-icon", "aria-hidden": "true" }, "\u2615\uFE0F"),
    h("span", { class: "btn-support-label" }, strings.support),
    h("span", { class: "btn-support-short" }, strings.supportShort),
  );
}
