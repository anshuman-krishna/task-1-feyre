"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function ThroughputChart({
  data,
}: {
  data: { day: string; total: number; high: number }[];
}) {
  const formatted = data.map((d) => ({
    ...d,
    day: new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prediction throughput</CardTitle>
        <CardDescription>Daily AI-generated observations and high-risk flags.</CardDescription>
      </CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="ana-pred" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(178 64% 30%)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(178 64% 30%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ana-risk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(22 90% 54%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(22 90% 54%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(220 13% 91%)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" stroke="hsl(220 9% 46%)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(220 9% 46%)" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "hsl(220 13% 91%)" }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(220 13% 91%)",
                fontSize: 12,
                padding: "8px 10px",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
              iconType="circle"
            />
            <Area
              name="Predictions"
              type="monotone"
              dataKey="total"
              stroke="hsl(178 64% 30%)"
              strokeWidth={2}
              fill="url(#ana-pred)"
            />
            <Area
              name="High-risk"
              type="monotone"
              dataKey="high"
              stroke="hsl(22 90% 54%)"
              strokeWidth={2}
              fill="url(#ana-risk)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
