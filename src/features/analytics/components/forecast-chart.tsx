"use client";

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ForecastPayload } from "@/services/analytics";

export function ForecastChart({ payload }: { payload: ForecastPayload }) {
  const series = [
    ...payload.history.map((p) => ({
      at: p.at,
      actual: p.value,
    })),
    ...payload.projection.map((p) => ({
      at: p.at,
      projected: p.value,
      low: p.low,
      high: p.high,
      range: (p.high ?? 0) - (p.low ?? 0),
      base: p.low,
    })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{payload.label}</CardTitle>
        <CardDescription>
          {payload.method === "linear_trend" ? "Linear trend" : "Moving average"} ·
          projected {payload.horizonDays}d · confidence {Math.round(payload.confidence * 100)}%
        </CardDescription>
      </CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="at"
              stroke="hsl(220 9% 46%)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              stroke="hsl(220 9% 46%)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={28}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(220 13% 91%)",
                fontSize: 11,
                padding: "8px 10px",
              }}
            />
            <Area
              type="monotone"
              dataKey="base"
              stackId="band"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="range"
              stackId="band"
              stroke="none"
              fill="hsl(220 75% 60% / 0.15)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="hsl(220 75% 50%)"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="projected"
              stroke="hsl(220 75% 50%)"
              strokeDasharray="4 4"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
