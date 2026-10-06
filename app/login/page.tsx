import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · TPO CDP" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-xl font-semibold">TPO Mini CDP</h1>
        <p className="mt-1 text-sm text-neutral-500">Enter the team password to continue.</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
