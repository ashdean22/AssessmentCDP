import { Chat } from "./chat";

export const metadata = { title: "Assistant · TPO CDP" };

export default function AssistantPage() {
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-3">
        <h1 className="text-2xl font-semibold">Ask the data</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Plain-English questions about readers. The model only sees counts and masked ids — never emails. Expand <em>What the AI saw</em> under any answer to check.
        </p>
      </div>
      <Chat />
    </div>
  );
}
