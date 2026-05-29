"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type EventName =
  | "prediction.queued"
  | "prediction.processing"
  | "prediction.completed"
  | "prediction.failed"
  | "notification.created"
  | "patient.status_changed"
  | "patient.archived"
  | "patient.assigned"
  | "summary.refreshed"
  | "automation.fired"
  | "priority.recomputed"
  | "trajectory.recomputed"
  | "analytics.refreshed";

// global SSE subscription. wires server-emitted events into the client:
// - react-query invalidations refresh client-fetched data
// - router.refresh() re-runs server components without losing client state
//
// debounced because a burst of events on first connect can trigger a flood.
export function useEvents() {
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, 400);
    };

    const es = new EventSource("/api/events/stream");

    const handle = (name: EventName, data: unknown) => {
      switch (name) {
        case "prediction.queued":
        case "prediction.processing": {
          const { patientId } = data as { patientId: string };
          qc.invalidateQueries({ queryKey: ["patient", patientId] });
          break;
        }
        case "prediction.completed": {
          const { patientId, riskLevel } = data as { patientId: string; riskLevel: string };
          qc.invalidateQueries({ queryKey: ["patients"] });
          qc.invalidateQueries({ queryKey: ["patient", patientId] });
          qc.invalidateQueries({ queryKey: ["predictions", patientId] });
          qc.invalidateQueries({ queryKey: ["activity"] });
          qc.invalidateQueries({ queryKey: ["analytics"] });
          scheduleRefresh();
          if (riskLevel === "critical" || riskLevel === "elevated") {
            toast.message("New prediction available", {
              description: `Risk classified as ${riskLevel}.`,
            });
          }
          break;
        }
        case "prediction.failed": {
          qc.invalidateQueries({ queryKey: ["activity"] });
          scheduleRefresh();
          break;
        }
        case "notification.created": {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          break;
        }
        case "patient.status_changed":
        case "patient.archived":
        case "patient.assigned": {
          qc.invalidateQueries({ queryKey: ["patients"] });
          qc.invalidateQueries({ queryKey: ["activity"] });
          scheduleRefresh();
          break;
        }
        case "summary.refreshed": {
          const { patientId } = data as { patientId: string };
          qc.invalidateQueries({ queryKey: ["summary", patientId] });
          break;
        }
        case "automation.fired": {
          qc.invalidateQueries({ queryKey: ["automation"] });
          qc.invalidateQueries({ queryKey: ["activity"] });
          break;
        }
        case "priority.recomputed": {
          qc.invalidateQueries({ queryKey: ["priority"] });
          break;
        }
        case "trajectory.recomputed": {
          const { patientId } = data as { patientId: string };
          qc.invalidateQueries({ queryKey: ["trajectory", patientId] });
          qc.invalidateQueries({ queryKey: ["analytics"] });
          break;
        }
        case "analytics.refreshed": {
          qc.invalidateQueries({ queryKey: ["analytics"] });
          scheduleRefresh();
          break;
        }
      }
    };

    const onAny = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        handle(ev.type as EventName, data);
      } catch {
        /* ignore */
      }
    };

    const types: EventName[] = [
      "prediction.queued",
      "prediction.processing",
      "prediction.completed",
      "prediction.failed",
      "notification.created",
      "patient.status_changed",
      "patient.archived",
      "patient.assigned",
      "summary.refreshed",
      "automation.fired",
      "priority.recomputed",
      "trajectory.recomputed",
      "analytics.refreshed",
    ];
    for (const t of types) es.addEventListener(t, onAny);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      for (const t of types) es.removeEventListener(t, onAny);
      es.close();
    };
  }, [qc, router]);
}
