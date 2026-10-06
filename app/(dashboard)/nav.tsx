"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/subscribers", label: "Subscribers" },
  { href: "/lookup", label: "Lookup" },
  { href: "/segments", label: "Segments" },
  { href: "/assistant", label: "Assistant" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`rounded-full px-3 py-1.5 transition-colors ${active ? "bg-espresso text-white dark:bg-white dark:text-neutral-900" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
