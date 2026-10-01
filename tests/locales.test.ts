import { describe, expect, it } from "vitest";
import {
  absoluteLocaleUrl,
  defaultLocale,
  enabledLocales,
  localeFromPath,
  localizePath,
  pickerLocales,
  showLanguagePicker,
  stripLocalePrefix,
} from "../src/i18n/locales";

describe("locales", () => {
  it("detects ua from path and defaults otherwise", () => {
    expect(localeFromPath("/ua/about/")).toBe("ua");
    expect(localeFromPath("/about/")).toBe("en");
    expect(localeFromPath("/")).toBe(defaultLocale());
  });

  it("localizes and strips paths", () => {
    expect(localizePath("about/", "ua")).toBe("ua/about/");
    expect(localizePath("about/", "en")).toBe("about/");
    expect(localizePath("", "ua")).toBe("ua/");
    expect(stripLocalePrefix("ua/about/")).toBe("about/");
    expect(stripLocalePrefix("about/")).toBe("about/");
  });

  it("builds absolute URLs and lists picker names alphabetically", () => {
    expect(absoluteLocaleUrl("https://saveyobrain.com", "about/", "ua")).toBe(
      "https://saveyobrain.com/ua/about/",
    );
    expect(pickerLocales().map((l) => l.nativeName)).toEqual(["English", "Українська"]);
    expect(showLanguagePicker()).toBe(enabledLocales().length > 1);
  });
});
