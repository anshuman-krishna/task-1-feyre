import { getCurrentUser } from "@/server/session";
import { listPolicies } from "@/services/governance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PolicyEditor } from "@/features/admin/components/policy-editor";

export const dynamic = "force-dynamic";

export default async function AdminPoliciesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const policies = await listPolicies(user.organizationId);

  return (
    <div className="space-y-4">
      {policies.map((p) => (
        <Card key={p.kind}>
          <CardHeader>
            <CardTitle className="capitalize">{p.kind}</CardTitle>
            <CardDescription>{p.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyEditor
              kind={p.kind}
              initial={p.config}
              defaults={p.defaults}
              revision={p.revision}
              enabled={p.enabled}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
