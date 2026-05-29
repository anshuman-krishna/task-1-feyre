import { listAutomationRules, recentAutomationEvents } from "@/services/automation";
import { getCurrentUser } from "@/server/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutomationRulesClient } from "@/features/admin/components/automation-rules";
import { formatDateTime, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminAutomationPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [rules, events] = await Promise.all([
    listAutomationRules(user.organizationId),
    recentAutomationEvents(user.organizationId, 15),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Automation rules</CardTitle>
          <CardDescription>
            Toggle rules per organization. Disabled rules are skipped on every trigger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AutomationRulesClient
            rules={rules.map((r) => ({
              key: r.key,
              name: r.name,
              description: r.description ?? "",
              trigger: r.trigger,
              enabled: r.enabled,
              fireCount: r.fireCount,
              lastFiredAt: r.lastFiredAt ? formatDateTime(r.lastFiredAt) : null,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent fires</CardTitle>
          <CardDescription>One row per rule fire with patient lineage.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fires yet.</p>
          ) : (
            <ul className="divide-y divide-border text-xs">
              {events.map((e) => (
                <li key={e.id} className="space-y-0.5 py-2">
                  <p className="font-medium text-foreground">
                    {e.ruleName}
                    {e.patient ? ` · ${e.patient.fullName}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                      {e.trigger}
                    </span>{" "}
                    · {e.reason}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{relativeTime(e.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
