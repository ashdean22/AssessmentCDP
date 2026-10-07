import { listSubscribers } from "@/lib/subscribers";
import { parseListParams } from "@/lib/subscribers-list";
import { Info } from "../info";
import { SubscriberBrowser } from "./browser";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscribers · TPO CDP" };

export default async function SubscribersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = parseListParams(await searchParams);
  const { rows, total } = await listSubscribers(params);
  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Subscribers</h1>
        <Info text="Every deduped reader, straight from the database. Filters apply as you type; click an email to open the full profile." />
      </div>
      <SubscriberBrowser initial={params} initialRows={rows} initialTotal={total} />
    </div>
  );
}
