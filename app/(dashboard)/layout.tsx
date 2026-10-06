import Link from "next/link";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/lookup", label: "Lookup" },
  { href: "/segments", label: "Segments" },
  { href: "/assistant", label: "Assistant" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            TPO <span className="text-neutral-500">Mini CDP</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={logout} className="ml-auto">
            <button className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
