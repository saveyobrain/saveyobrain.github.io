/** Mobile nav toggle + language picker shared by all static pages. */

export function initNav(): void {
  const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
  const nav = document.querySelector<HTMLElement>("#site-nav");
  if (!toggle || !nav) return;

  const close = () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

export function initLangPicker(): void {
  document.querySelectorAll<HTMLElement>(".lang-picker").forEach((picker) => {
    const button = picker.querySelector<HTMLButtonElement>(".lang-toggle");
    const menu = picker.querySelector<HTMLElement>(".lang-menu");
    if (!button || !menu) return;

    const close = () => {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
      picker.classList.remove("is-open");
    };

    const open = () => {
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      picker.classList.add("is-open");
    };

    button.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menu.hidden) open();
      else close();
    });

    document.addEventListener("click", (e) => {
      if (!picker.contains(e.target as Node)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  });
}
