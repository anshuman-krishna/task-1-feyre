import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationsClient } from "@/features/admin/components/simulations-client";

export const dynamic = "force-dynamic";

export default function AdminSimulationsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reliability simulations</CardTitle>
        <CardDescription>
          Drive the system into known stress modes to validate fallbacks. Each run is audited
          and produces metrics. Use sparingly in shared environments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SimulationsClient />
      </CardContent>
    </Card>
  );
}
