/**
 * Small "what does this do" hint. Hover or focus the ⓘ to read it.
 * Pure CSS so it works inside server components.
 */
export function Info({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`group relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={text}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-300 text-[10px] font-semibold leading-none text-neutral-500 hover:border-coral hover:text-coral focus:border-coral focus:text-coral focus:outline-none dark:border-neutral-600"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-64 rounded-xl bg-espresso px-3 py-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-white dark:text-neutral-900"
      >
        {text}
      </span>
    </span>
  );
}
