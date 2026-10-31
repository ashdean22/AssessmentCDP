import { Logo } from "@/app/(dashboard)/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Pulse CDP" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-950">
        <Logo size={44} />
        <h1 className="mt-5 text-2xl font-semibold leading-tight tracking-tight">Every reader,<br />one profile.</h1>
        <p className="mt-2 text-sm text-neutral-500">Newsletter, web and app data in one place. Enter the team password to continue.</p>
        <LoginForm next={next ?? "/"} />
        <p className="mt-6 text-xs text-neutral-400">Pulse CDP · internal tool for the Growth team.</p>
      </div>
    </main>
  );
}
