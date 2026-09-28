/** Copy buttons for crypto wallet addresses on /support-the-project/. */
export function initWalletCopy(): void {
  document.querySelectorAll<HTMLButtonElement>(".wallet-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.dataset.copy ?? "";
      if (!value) return;
      const label = btn.textContent;
      try {
        await navigator.clipboard.writeText(value);
        btn.textContent = "Copied";
      } catch {
        btn.textContent = "Failed";
      }
      window.setTimeout(() => {
        btn.textContent = label;
      }, 1500);
    });
  });
}
