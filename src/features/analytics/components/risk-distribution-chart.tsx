"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const colors: Record<string, string> = {
  low: "hsl(152 60% 40%)",
  moderate: "hsl(38 92% 50%)",
  elevated: "hsl(22 90% 54%)",
  critical: "hsl(0 72% 51%)",
  unassessed: "hsl(220 9% 55%)",
};

export function RiskDistributionChart({
  data,
}: {
  data: { level: string; count: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk distribution</CardTitle>
        <CardDescription>Active patients by AI risk level.</CardDescription>
      </CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="hsl(220 13% 91%)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="level"
              stroke="hsl(220 9% 46%)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
            />
            <YAxis
              stroke="hsl(220 9% 46%)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={28}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "hsl(220 14% 96%)" }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(220 13% 91%)",
                fontSize: 12,
                padding: "8px 10px",
              }}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { level: string } }) => {
                const { x = 0, y = 0, width = 0, height = 0, payload } = props;
                return (
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx={4}
                    fill={colors[payload?.level ?? "unassessed"] ?? colors.unassessed}
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
