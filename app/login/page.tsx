import { Logo } from "@/app/(dashboard)/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · TPO Mini CDP" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-950">
        <Logo size={44} />
        <h1 className="mt-4 text-2xl font-semibold leading-tight">The readers you need.<br />The data you crave.</h1>
        <p className="mt-2 text-sm text-neutral-500">Team password to pour yourself in.</p>
        <LoginForm next={next ?? "/"} />
        <p className="mt-6 text-xs text-neutral-400">Grab a coffee. Always free. Totally unsubscribable (not really, this is the admin).</p>
      </div>
    </main>
  );
}
