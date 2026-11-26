import type { Strings } from "../i18n/strings/types";

/** Localized title/description for a registered game id. */
export function gameCopy(strings: Strings, gameId: string): { title: string; description: string; pageTitle: string } {
  if (gameId === "look-up") {
    return {
      title: strings.lookUp.title,
      description: strings.lookUp.description,
      pageTitle: strings.lookUp.pageTitle,
    };
  }
  return {
    title: strings.stl.title,
    description: strings.stl.description,
    pageTitle: strings.stl.pageTitle,
  };
}
