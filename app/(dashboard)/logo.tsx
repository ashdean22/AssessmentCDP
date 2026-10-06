/** Coral ring + monogram, a nod to the site's mark. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-coral font-semibold tracking-tight text-coral"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      aria-hidden
    >
      TPO
    </span>
  );
}
