"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

type Range = {
  ok: [number, number];
  watch?: [number, number];
};

const RANGES: Record<string, Range> = {
  glucose: { ok: [70, 110], watch: [110, 140] },
  haemoglobin: { ok: [12, 17] },
  cholesterol: { ok: [120, 200], watch: [200, 240] },
  systolic: { ok: [90, 130], watch: [130, 140] },
  diastolic: { ok: [60, 80], watch: [80, 90] },
  bmi: { ok: [18.5, 25], watch: [25, 30] },
};

function statusFor(field: string, value: number | null): "ok" | "watch" | "out" | "idle" {
  if (value == null || Number.isNaN(value)) return "idle";
  const r = RANGES[field];
  if (!r) return "idle";
  if (value >= r.ok[0] && value <= r.ok[1]) return "ok";
  if (r.watch && value > r.watch[0] && value <= r.watch[1]) return "watch";
  return "out";
}

const dotColor: Record<string, string> = {
  ok: "bg-emerald-500",
  watch: "bg-amber-500",
  out: "bg-red-500",
  idle: "bg-muted-foreground/30",
};

export function BiomarkerInput({
  name,
  label,
  unit,
  step = "any",
  value,
  onChange,
  hint,
}: {
  name: string;
  label: string;
  unit: string;
  step?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const numeric = value === "" ? null : Number(value);
  const status = statusFor(name, numeric);
  const range = RANGES[name];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={name} className="text-foreground">
          {label}
        </Label>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[status])} />
          <span>{unit}</span>
        </div>
      </div>
      <Input
        id={name}
        name={name}
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={range ? `${range.ok[0]}–${range.ok[1]}` : undefined}
      />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
