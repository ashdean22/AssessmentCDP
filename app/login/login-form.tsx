"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-full border border-neutral-300 bg-transparent px-4 py-2.5 outline-none focus:border-coral dark:border-neutral-700 dark:focus:border-neutral-200"
        />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-coral px-3 py-2.5 text-sm font-medium text-white hover:bg-espresso disabled:opacity-50"
      >
        {pending ? "Pouring…" : "Pour me in"}
      </button>
    </form>
  );
}
