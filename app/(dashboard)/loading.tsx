/** Instant skeleton while a page's data loads, so navigation never feels stuck. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy>
      <div className="h-8 w-48 rounded-full bg-neutral-100 dark:bg-neutral-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-neutral-100 dark:bg-neutral-800" />)}
      </div>
      <div className="h-40 rounded-xl bg-neutral-100 dark:bg-neutral-800" />
      <div className="h-64 rounded-xl bg-neutral-100 dark:bg-neutral-800" />
    </div>
  );
}
