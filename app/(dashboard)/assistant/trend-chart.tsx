"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const LABEL: Record<string, string> = {
  signups: "Signups",
  last_opens: "Readers whose last open fell in period",
  web_visits: "Web visits",
  app_events: "App events",
};

export function TrendChart({ series, metric }: { series: { period: string; count: number }[]; metric: string }) {
  if (!series.length) return <div className="mt-2 text-neutral-400">No data in range.</div>;
  return (
    <div className="mt-2">
      <div className="mb-1 text-neutral-500">{LABEL[metric] ?? metric} per period</div>
      <div className="h-44 w-full min-w-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Bar isAnimationActive={false} dataKey="count" fill="#f2817d" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
