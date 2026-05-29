import { AlertTriangle, Info, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Insight = {
  id: string;
  category: string;
  severity: string;
  headline: string;
  detail: string | null;
  createdAt: Date;
};

export function InsightFeed({ insights }: { insights: Insight[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational insights</CardTitle>
        <CardDescription>
          Generated rules over snapshot history — meant to read as one-line operator notes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No insights yet. Capture a few snapshots so the rules have something to compare.
          </p>
        ) : (
          <ul className="space-y-3">
            {insights.slice(0, 8).map((i) => {
              const Icon =
                i.severity === "alert"
                  ? AlertTriangle
                  : i.severity === "watch"
                    ? Sparkles
                    : Info;
              const tone =
                i.severity === "alert"
                  ? "text-rose-600 bg-rose-50"
                  : i.severity === "watch"
                    ? "text-amber-600 bg-amber-50"
                    : "text-sky-600 bg-sky-50";
              return (
                <li key={i.id} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      tone,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm text-foreground">{i.headline}</p>
                    {i.detail ? (
                      <p className="text-[11px] text-muted-foreground">{i.detail}</p>
                    ) : null}
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {i.category}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
