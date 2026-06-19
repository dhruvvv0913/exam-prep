// Small a11y helper for modal dialogs: closes on Escape, moves focus into the
// dialog when it opens, TRAPS Tab focus inside it, and restores focus to the
// previously-focused element when it closes. Returns a ref to put on the dialog
// panel (give it role="dialog" aria-modal="true", tabIndex={-1}, an aria-label).
// Keeps the latest onClose in a ref so the listener is attached once.
import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDismissable(onClose) {
  const cb = useRef(onClose);
  cb.current = onClose;
  const ref = useRef(null);
  useEffect(() => {
    const prevFocus = document.activeElement; // restore here on close
    const onKey = (e) => {
      if (e.key === "Escape") { cb.current?.(); return; }
      if (e.key === "Tab" && ref.current) {
        const items = ref.current.querySelectorAll(FOCUSABLE);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === ref.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus?.(); // announce the dialog + capture keyboard focus
    return () => {
      document.removeEventListener("keydown", onKey);
      try { prevFocus?.focus?.(); } catch (e) {}
    };
  }, []);
  return ref;
}
