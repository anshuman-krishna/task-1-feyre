import { listProviders, providerCircuitSnapshot } from "@/services/prediction/providers";
import { listAIProviders } from "@/services/ai";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  const prediction = listProviders();
  const circuits = providerCircuitSnapshot();
  const orchestration = listAIProviders();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Prediction providers</CardTitle>
          <CardDescription>
            Per-provider circuit state. Internal heuristic is the floor and never degrades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Provider</th>
                <th className="py-1 text-left font-medium">Model</th>
                <th className="py-1 text-left font-medium">Circuit</th>
                <th className="py-1 text-right font-medium">Failures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {prediction.map((p) => {
                const c = (circuits as Record<string, { state: string; failures: number }>)[p.name];
                return (
                  <tr key={p.name}>
                    <td className="py-1.5 capitalize">{p.name}</td>
                    <td className="py-1.5 text-muted-foreground">{p.model ?? "—"}</td>
                    <td className="py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                          c?.state === "open"
                            ? "bg-red-50 text-red-700"
                            : c?.state === "half"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {c?.state ?? "closed"}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-mono">{c?.failures ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orchestration providers</CardTitle>
          <CardDescription>
            Used by patient summaries and the operational copilot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Provider</th>
                <th className="py-1 text-left font-medium">Model</th>
                <th className="py-1 text-left font-medium">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {orchestration.map((p) => (
                <tr key={p.name}>
                  <td className="py-1.5 capitalize">{p.name}</td>
                  <td className="py-1.5 text-muted-foreground">{p.model ?? "—"}</td>
                  <td className="py-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        p.available
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {p.available ? "yes" : "open"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
