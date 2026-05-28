import Link from "next/link";
import { AlertTriangle, BellRing, CalendarClock, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RiskBadge } from "@/components/risk-badge";
import { operationalAlerts } from "@/services/analytics";
import { relativeTime, formatDate } from "@/lib/format";

export async function AlertsPanel() {
  const { criticalUnreviewed, followUpDue, failedPredictions } = await operationalAlerts();
  const empty =
    criticalUnreviewed.length === 0 && followUpDue.length === 0 && failedPredictions.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-3.5 w-3.5 text-amber-600" /> Needs attention
        </CardTitle>
        <CardDescription>Operational items the workspace should triage now.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {empty ? (
          <EmptyState
            title="All clear"
            description="No critical unreviewed patients, due follow-ups, or failed predictions in the last 24 hours."
          />
        ) : (
          <>
            {criticalUnreviewed.length > 0 && (
              <Section title="Critical, unreviewed in 24h" icon={<AlertTriangle className="h-3 w-3" />}>
                {criticalUnreviewed.map((p) => (
                  <Item
                    key={p.id}
                    href={`/patients/${p.id}`}
                    primary={p.fullName}
                    secondary={`${p.aiPrediction ?? "—"}${p.assignedTo ? ` · ${p.assignedTo.name}` : ""}`}
                    right={<RiskBadge level={p.riskLevel} showDot={false} />}
                  />
                ))}
              </Section>
            )}
            {followUpDue.length > 0 && (
              <Section title="Follow-ups due" icon={<CalendarClock className="h-3 w-3" />}>
                {followUpDue.map((p) => (
                  <Item
                    key={p.id}
                    href={`/patients/${p.id}`}
                    primary={p.fullName}
                    secondary={p.assignedTo?.name ?? "Unassigned"}
                    right={
                      <span className="text-[11px] font-medium text-destructive">
                        {p.followUpAt ? formatDate(p.followUpAt) : ""}
                      </span>
                    }
                  />
                ))}
              </Section>
            )}
            {failedPredictions.length > 0 && (
              <Section title="Prediction failures (24h)" icon={<Sparkles className="h-3 w-3" />}>
                {failedPredictions.map((f) => (
                  <Item
                    key={f.id}
                    href={`/patients/${f.patientId}`}
                    primary={f.patient?.fullName ?? "Unknown patient"}
                    secondary={`${f.provider} · ${f.error ?? "no detail"}`}
                    right={<span className="text-[11px] text-muted-foreground">{relativeTime(f.createdAt)}</span>}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Item({
  href,
  primary,
  secondary,
  right,
}: {
  href: string;
  primary: string;
  secondary: string;
  right: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">{primary}</p>
        <p className="truncate text-xs text-muted-foreground">{secondary}</p>
      </div>
      <div className="shrink-0">{right}</div>
    </Link>
  );
}
