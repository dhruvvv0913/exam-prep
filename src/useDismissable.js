// Small a11y helper for modal dialogs: closes on Escape and moves focus into
// the dialog when it opens. Returns a ref to put on the dialog panel (give it
// role="dialog" aria-modal="true" and an aria-label). Keeps the latest onClose
// in a ref so the listener is attached once (no focus-stealing re-runs).
import { useEffect, useRef } from "react";

export function useDismissable(onClose) {
  const cb = useRef(onClose);
  cb.current = onClose;
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") cb.current?.(); };
    document.addEventListener("keydown", onKey);
    ref.current?.focus?.(); // announce the dialog + capture keyboard focus
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return ref;
}
