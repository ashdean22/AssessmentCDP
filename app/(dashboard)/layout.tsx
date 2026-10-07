import Link from "next/link";
import { logout } from "@/app/login/actions";
import { Logo } from "./logo";
import { Nav } from "./nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <Logo />
            <span>Mini CDP <span className="font-normal text-neutral-500">by The Pour Over</span></span>
          </Link>
          <Nav />
          <form action={logout} className="ml-auto">
            <button className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-coral hover:text-coral dark:border-neutral-700 dark:text-neutral-300">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-xs text-neutral-400">
        The news you need. The data you crave. ☕ “Today” is 2026-09-28 for every number on this site.
      </footer>
    </>
  );
}
