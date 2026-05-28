"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export function GrowthChart({ data }: { data: { week: string; total: number }[] }) {
  const formatted = data.map((d) => ({
    ...d,
    week: new Date(d.week).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient growth</CardTitle>
        <CardDescription>New patients added per week.</CardDescription>
      </CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formatted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="hsl(220 13% 91%)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" stroke="hsl(220 9% 46%)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(220 9% 46%)" fontSize={11} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "hsl(220 14% 96%)" }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(220 13% 91%)",
                fontSize: 12,
                padding: "8px 10px",
              }}
            />
            <Bar dataKey="total" fill="hsl(178 64% 30%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
