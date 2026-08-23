"use client";

import { useEffect } from "react";

/**
 * Drives the two scroll behaviours on the marketing page:
 *  - [data-reveal] elements blur-and-rise into place, staggered by their value
 *  - [data-cool-layer] fades in as you approach the footer
 * A 2.6s failsafe force-shows anything still hidden, so content can never
 * get stuck invisible if the observer never fires.
 */
export default function ScrollReveal() {
  useEffect(() => {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    const show = (el: HTMLElement) => {
      const i = Number(el.dataset.reveal || 1);
      const d = i * 0.09;
      el.style.transition = [
        `opacity 1.1s var(--ease) ${d}s`,
        `transform 1.2s var(--ease) ${d}s`,
        `filter 1.2s ease ${d}s`,
      ].join(", ");
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.filter = "none";
    };

    if (reduce) {
      nodes.forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.filter = "none";
      });
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          show(e.target as HTMLElement);
          io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -5% 0px" },
    );

    nodes.forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(26px)";
      el.style.filter = "blur(6px)";
      io.observe(el);
    });

    const failsafe = window.setTimeout(() => {
      nodes.forEach((el) => {
        if (getComputedStyle(el).opacity !== "1") show(el);
      });
    }, 2600);

    const cool = document.querySelector<HTMLElement>("[data-cool-layer]");
    const onScroll = () => {
      if (!cool) return;
      const max = document.body.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      cool.style.opacity = String(p * 0.85);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
