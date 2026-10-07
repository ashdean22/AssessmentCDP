"use client";

import { useLayoutEffect, useRef, useState, type SelectHTMLAttributes } from "react";

/**
 * A <select> that is only as wide as its *selected* option, so the chevron
 * sits right next to the text instead of at the far edge of the widest option.
 */
export function AutoSelect({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const ref = useRef<HTMLSelectElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  const measure = () => {
    const sel = ref.current, span = probe.current;
    if (!sel || !span) return;
    span.textContent = sel.options[sel.selectedIndex]?.text ?? "";
    setWidth(span.offsetWidth + 44); // text + left pad + chevron + right pad
  };
  useLayoutEffect(measure, []);

  return (
    <>
      <select ref={ref} {...rest} className={className} style={{ width }} onChange={(e) => { measure(); rest.onChange?.(e); }}>
        {children}
      </select>
      <span ref={probe} aria-hidden className={`pointer-events-none fixed -left-[9999px] top-0 whitespace-nowrap ${className}`} />
    </>
  );
}
