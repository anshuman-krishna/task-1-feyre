"use client";

import { Brain, Workflow, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";
import { usePatientLineage } from "../queries";

export function LineagePanel({ patientId }: { patientId: string }) {
  const { data, isLoading } = usePatientLineage(patientId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-primary" /> Decision lineage
        </CardTitle>
        <CardDescription>
          Every AI run, summary revision and automation event recorded for this patient.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="runs">
          <TabsList>
            <TabsTrigger value="runs">AI runs</TabsTrigger>
            <TabsTrigger value="revisions">Summary revisions</TabsTrigger>
            <TabsTrigger value="events">Automation</TabsTrigger>
          </TabsList>

          <TabsContent value="runs">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !data || data.runs.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No AI runs yet.</p>
            ) : (
              <ul className="divide-y divide-border text-xs">
                {data.runs.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                    <div>
                      <p className="flex items-center gap-1.5 font-medium text-foreground">
                        <Brain className="h-3 w-3 text-muted-foreground" /> {r.task}
                        {r.degraded && (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                            degraded
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        {r.provider}
                        {r.model ? ` · ${r.model}` : ""} · {r.promptId}@{r.promptVersion}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-muted-foreground">{r.latencyMs}ms</p>
                      <p className="text-[10px] text-muted-foreground">{relativeTime(r.createdAt)}</p>
                      {r.confidence != null && (
                        <p className="text-[10px] text-muted-foreground">
                          conf {Math.round(r.confidence * 100)}%
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="revisions">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !data || data.revisions.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No revisions yet.</p>
            ) : (
              <ul className="divide-y divide-border text-xs">
                {data.revisions.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                    <div>
                      <p className="font-medium text-foreground">Revision {r.revision}</p>
                      <p className="text-muted-foreground">
                        {r.generatedBy} · prompt v{r.promptVersion} · {r.approvalState}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">{relativeTime(r.createdAt)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        conf {Math.round(r.confidence * 100)}%
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="events">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !data || data.events.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No automation events.</p>
            ) : (
              <ul className="divide-y divide-border text-xs">
                {data.events.map((e) => (
                  <li key={e.id} className="space-y-0.5 py-2">
                    <p className="flex items-center gap-1.5 font-medium text-foreground">
                      <Workflow className="h-3 w-3 text-muted-foreground" /> {e.ruleName}
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
