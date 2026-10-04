export const SITE_NAME = "Save Yo Brain";
export const SITE_SLUG = "saveyobrain";
export const SITE_URL = "https://saveyobrain.com";
export const STORAGE_PREFIX = `${SITE_SLUG}:v1`;

export const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/saveyobrain";
/** In-site Support page (About, Feedback, and game modals link here). */
export const SUPPORT_PAGE_PATH = "support-the-project/";
export const CONTACT_URL = "https://github.com/saveyobrain/saveyobrain.github.io/issues";

/** Discord community invite (keep in sync with links in content/about.md and content/feedback.md). */
export const DISCORD_INVITE_URL = "https://discord.gg/v8EGtW688";

/** Short link to the English feedback form (open in new tab). */
export const FEEDBACK_FORM_SHORT_URL = "https://forms.gle/dskxjxmu7NDkUY1b8";
/** Short link to the Ukrainian feedback form (open in new tab). */
export const FEEDBACK_FORM_SHORT_URL_UA = "https://forms.gle/HtuzpqgUrTvGVdQE9";

/**
 * Google Form embed URL for /feedback/.
 * Keep in sync with `embedUrl` in content/en/feedback.md (build uses the Markdown frontmatter).
 */
export const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdfjgMoOUw0DBkMYDs1Q6JeXNQ09fTrczsQNTDfB8COX8snkA/viewform?embedded=true";
/**
 * Google Form embed URL for /ua/feedback/.
 * Keep in sync with `embedUrl` in content/ua/feedback.md.
 */
export const FEEDBACK_FORM_URL_UA =
  "https://docs.google.com/forms/d/e/1FAIpQLScuiiKGf5HdM59y7R3IK32U5jfo4yZvNEwPLt1iRd5hi-oAyQ/viewform?embedded=true";

/** Umami Cloud Hobby tracker (public website id; not a secret). */
export const UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";
export const UMAMI_WEBSITE_ID = "27d41969-25e7-49bb-b973-f1033571809c";
/** Hostname allow-list for the tracker; keep in sync with `data-domains` on the script tags. */
export const UMAMI_DOMAINS = "saveyobrain.com";

/** Shown on the Terms & Privacy page; update when the text in content/terms-privacy.md changes. */
export const LEGAL_UPDATED = "September 28, 2026";
