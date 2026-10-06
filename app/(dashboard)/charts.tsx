"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const grid = <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />;
const tip = <Tooltip contentStyle={{ fontSize: 11 }} cursor={{ fill: "currentColor", opacity: 0.05 }} />;

export function SourceBar({ data }: { data: { source: string; count: number }[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          {grid}
          <XAxis dataKey="source" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          {tip}
          <Bar dataKey="count" name="signups" fill="#525252" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OpensLine({ data }: { data: { period: string; count: number }[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          {grid}
          <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          {tip}
          <Line type="monotone" dataKey="count" name="readers" stroke="#525252" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FirstPagesBar({ data }: { data: { page: string; count: number }[] }) {
  return (
    <div className="w-full" style={{ height: Math.max(120, 26 * data.length + 20) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
          {grid}
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis type="category" dataKey="page" width={120} tick={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }} />
          {tip}
          <Bar dataKey="count" name="new subscribers" fill="#525252" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
