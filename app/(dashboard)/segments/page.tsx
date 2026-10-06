import { db } from "@/lib/db";
import { SegmentBuilder } from "./builder";
import type { Filter } from "@/lib/segments/fields";

export const dynamic = "force-dynamic";
export const metadata = { title: "Segments · TPO CDP" };

const DEFAULT_FILTER: Filter = {
  op: "AND",
  rules: [
    { field: "source", cmp: "is", value: "instagram" },
    { field: "days_since_open", cmp: "gt", value: 30 },
  ],
};

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const supabase = db();
  const [{ data: segments }, { data: pages }, loaded] = await Promise.all([
    supabase.from("segments").select("id,name,filter_json,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.rpc("distinct_pages"),
    id ? supabase.from("segments").select("id,name,filter_json").eq("id", Number(id)).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const initial = loaded?.data
    ? { name: loaded.data.name as string, filter: loaded.data.filter_json as Filter }
    : { name: "", filter: DEFAULT_FILTER };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Build a segment</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Rules are field + comparison + value. Group them with AND / OR; groups can nest. Counts come straight from the database.
      </p>
      <SegmentBuilder
        initialName={initial.name}
        initialFilter={initial.filter}
        savedSegments={(segments ?? []) as { id: number; name: string; filter_json: Filter; created_at: string }[]}
        knownPages={((pages ?? []) as { page: string }[]).map((p) => p.page)}
      />
    </div>
  );
}
