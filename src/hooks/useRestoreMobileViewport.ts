import { useEffect } from "react";

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isTextField(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return true;
  }
  if (el instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

function viewportMeta(): HTMLMetaElement | null {
  return document.querySelector('meta[name="viewport"]');
}

function scaleLimitsRemoved(content: string): string {
  return content
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 0 &&
        !part.startsWith("maximum-scale") &&
        !part.startsWith("minimum-scale"),
    )
    .join(", ");
}

/**
 * iOS Safari zooms into focused text fields and often never unzooms on blur.
 * Briefly locking maximum-scale forces the visual viewport back to 1, then
 * pinch-zoom is restored. Timeouts are used instead of rAF because iOS pauses
 * animation frames while the keyboard is closing.
 */
function restoreViewportScale() {
  const meta = viewportMeta();
  if (!meta) return 0;

  const current = meta.getAttribute("content");
  if (!current) return 0;

  const restored = scaleLimitsRemoved(current);
  meta.setAttribute("content", `${restored}, maximum-scale=1.0`);

  return window.setTimeout(() => {
    if (isTextField(document.activeElement)) return;
    meta.setAttribute("content", restored);
  }, 100);
}

export function useRestoreMobileViewport() {
  useEffect(() => {
    let restoreTimer: number | undefined;
    let unlockTimer: number | undefined;

    const cancelTimers = () => {
      window.clearTimeout(restoreTimer);
      window.clearTimeout(unlockTimer);
    };

    const scheduleRestore = () => {
      window.clearTimeout(restoreTimer);
      restoreTimer = window.setTimeout(() => {
        if (isTextField(document.activeElement)) return;
        window.clearTimeout(unlockTimer);
        unlockTimer = restoreViewportScale();
      }, 300);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isTextField(event.target)) return;
      window.clearTimeout(restoreTimer);
    };

    const onFocusOut = (event: FocusEvent) => {
      if (!isTextField(event.target)) return;
      scheduleRestore();
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      cancelTimers();
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
}
