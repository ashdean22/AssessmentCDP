import { Chat } from "./chat";
import { Info } from "../info";

export const metadata = { title: "Assistant · TPO CDP" };

export default function AssistantPage() {
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-3">
        <div className="flex items-center gap-2"><h1 className="text-2xl font-semibold">Ask the data</h1><Info text="Ask in plain English, by text or by tapping the mic. The model can only call fixed tools that return counts and masked ids; full tables are loaded by your browser, never by the model." /></div>
        <p className="mt-1 text-sm text-neutral-500">
          Plain-English questions about readers. The model only sees counts and masked ids — never emails. Expand <em>What the AI saw</em> under any answer to check.
        </p>
      </div>
      <Chat />
    </div>
  );
}
