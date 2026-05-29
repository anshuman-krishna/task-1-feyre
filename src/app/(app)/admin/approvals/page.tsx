import { getCurrentUser } from "@/server/session";
import { listApprovals } from "@/services/governance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApprovalsClient } from "@/features/admin/components/approvals-client";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const approvals = await listApprovals(user.organizationId, { limit: 60 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval queue</CardTitle>
        <CardDescription>
          Human sign-off on summary publication, workflow escalations and policy changes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ApprovalsClient
          rows={approvals.map((a) => ({
            id: a.id,
            kind: a.kind,
            state: a.state,
            targetType: a.targetType,
            targetId: a.targetId,
            patient: a.patient,
            requester: a.requestedBy?.name ?? null,
            decider: a.decidedBy?.name ?? null,
            requestedReason: a.requestedReason,
            decisionReason: a.decisionReason,
            createdAt: formatDateTime(a.createdAt),
            decidedAt: a.decidedAt ? formatDateTime(a.decidedAt) : null,
          }))}
        />
      </CardContent>
    </Card>
  );
}
