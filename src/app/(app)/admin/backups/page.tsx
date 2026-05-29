import { getCurrentUser } from "@/server/session";
import { listSnapshots } from "@/services/backup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupClient } from "@/features/admin/components/backup-client";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminBackupsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const snapshots = await listSnapshots(user.organizationId, 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recovery snapshots</CardTitle>
        <CardDescription>
          Point-in-time JSON digests of workspace state. Architecture seam for real cloud
          backups; useful today for pre-change captures and DR drills.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BackupClient
          snapshots={snapshots.map((s) => ({
            id: s.id,
            label: s.label,
            kind: s.kind,
            bytes: s.bytes,
            createdAt: formatDateTime(s.createdAt),
          }))}
        />
      </CardContent>
    </Card>
  );
}
