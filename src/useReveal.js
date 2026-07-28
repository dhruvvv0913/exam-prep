// Scroll-triggered reveal: returns a ref to put on an element (plus the
// "pyq-reveal" class, see index.css) that fades/rises in the first time it
// crosses into the viewport, then stops observing (one-shot, cheap). Respects
// prefers-reduced-motion by not bothering to observe at all (CSS shows it
// immediately in that case).
import { useEffect, useRef } from "react";

export function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined" || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { el.classList.add("in"); io.unobserve(el); }
    }, { threshold, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}
