import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AutomationHealth } from "@/services/analytics";

export function AutomationHealthPanel({ data }: { data: AutomationHealth }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation health</CardTitle>
        <CardDescription>
          Fires per rule, approvals downstream, confidence skips.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Stat label="Fires 7d" value={`${data.totalFires7d}`} />
          <Stat
            label="Acceptance"
            value={
              data.acceptanceRate == null
                ? "—"
                : `${Math.round(data.acceptanceRate * 100)}%`
            }
          />
          <Stat
            label="Conf skips"
            value={`${data.confidenceSkipped}`}
          />
        </div>

        {data.byRule.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rules configured.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.byRule.slice(0, 6).map((r) => (
              <li
                key={r.ruleKey}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-foreground">{r.ruleName}</span>
                <span className="font-mono text-muted-foreground">
                  {r.fires} fires
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
