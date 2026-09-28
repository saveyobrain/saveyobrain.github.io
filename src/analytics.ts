type UmamiTracker = {
  track: (name: string, data?: Record<string, string | number | boolean>) => void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

/** Fire a custom Umami event. No-ops when the tracker is missing or blocked. */
export function track(name: string, data?: Record<string, string | number | boolean>): void {
  window.umami?.track(name, data);
}
