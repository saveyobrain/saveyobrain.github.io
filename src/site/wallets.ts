import { track } from "../analytics";
import { getActiveLocale } from "../i18n/strings";
import { getStrings } from "../i18n/strings";

/** Copy buttons for crypto wallet addresses on /support-the-project/. */
export function initWalletCopy(): void {
  const s = getStrings();
  document.querySelectorAll<HTMLButtonElement>(".wallet-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.dataset.copy ?? "";
      if (!value) return;
      const label = btn.textContent;
      try {
        await navigator.clipboard.writeText(value);
        btn.textContent = s.chrome.walletCopied;
        track("wallet_copy", {
          wallet: btn.dataset.wallet ?? "unknown",
          locale: getActiveLocale(),
        });
      } catch {
        btn.textContent = s.chrome.walletFailed;
      }
      window.setTimeout(() => {
        btn.textContent = label;
      }, 1500);
    });
  });
}

/** Track Buy Me a Coffee outbound clicks. */
export function initBmcTracking(): void {
  document.querySelectorAll<HTMLAnchorElement>("a.bmc-link").forEach((link) => {
    link.addEventListener("click", () => {
      track("bmc_click", { locale: getActiveLocale() });
    });
  });
}
