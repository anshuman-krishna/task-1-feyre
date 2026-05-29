import Link from "next/link";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Archive,
  Brain,
  Building2,
  ClipboardList,
  Database,
  Eye,
  FileDown,
  Flame,
  LogIn,
  LogOut,
  Pencil,
  RotateCcw,
  ScrollText,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  UserPlus,
  Wand2,
  Workflow,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { STATUS_LABELS } from "@/services/workflow/constants";
import type { WorkflowStatus } from "@prisma/client";

export type ActivityEntry = {
  id: string;
  action:
    | "create"
    | "update"
    | "archive"
    | "restore"
    | "predict"
    | "predict_fail"
    | "note_add"
    | "note_remove"
    | "export"
    | "view"
    | "assign"
    | "status_change"
    | "sign_in"
    | "sign_out"
    | "bulk_archive"
    | "bulk_status"
    | "automation_fire"
    | "summary_refresh"
    | "copilot_query"
    | "approval_requested"
    | "approval_decided"
    | "policy_change"
    | "provider_change"
    | "rule_toggled"
    | "org_switch"
    | "simulation_run"
    | "manual_retry"
    | "backup_created"
    | "consent_change"
    | "retention_change";
  patientId: string | null;
  patientName: string | null;
  performedBy: string | null;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  metadata: unknown;
  createdAt: string;
};

const meta: Record<
  ActivityEntry["action"],
  { icon: React.ElementType; tint: string; label: (e: ActivityEntry) => string }
> = {
  create: {
    icon: UserPlus,
    tint: "bg-emerald-50 text-emerald-700",
    label: (e) => `added ${e.patientName ?? "a patient"}`,
  },
  update: {
    icon: Pencil,
    tint: "bg-amber-50 text-amber-800",
    label: (e) => `updated ${e.patientName ?? "a patient"}`,
  },
  archive: {
    icon: Archive,
    tint: "bg-muted text-muted-foreground",
    label: (e) => `archived ${e.patientName ?? "a patient"}`,
  },
  restore: {
    icon: Archive,
    tint: "bg-emerald-50 text-emerald-700",
    label: (e) => `restored ${e.patientName ?? "a patient"}`,
  },
  predict: {
    icon: Sparkles,
    tint: "bg-accent text-accent-foreground",
    label: (e) => {
      const m = e.metadata as { riskLevel?: string; provider?: string } | null;
      return `AI prediction · ${m?.riskLevel ?? "—"}${m?.provider ? ` (${m.provider})` : ""} for ${e.patientName ?? "patient"}`;
    },
  },
  predict_fail: {
    icon: AlertTriangle,
    tint: "bg-red-50 text-red-700",
    label: (e) => `prediction failed for ${e.patientName ?? "patient"}`,
  },
  note_add: {
    icon: ClipboardList,
    tint: "bg-amber-50 text-amber-800",
    label: (e) => `added a note on ${e.patientName ?? "a patient"}`,
  },
  note_remove: {
    icon: Trash2,
    tint: "bg-muted text-muted-foreground",
    label: (e) => `removed a note from ${e.patientName ?? "a patient"}`,
  },
  export: {
    icon: FileDown,
    tint: "bg-muted text-muted-foreground",
    label: (e) => {
      const m = e.metadata as { format?: string; count?: number } | null;
      if (m?.count != null) return `exported ${m.count} patients (${m.format ?? "csv"})`;
      return `exported ${e.patientName ?? "a record"}`;
    },
  },
  view: {
    icon: Eye,
    tint: "bg-muted text-muted-foreground",
    label: (e) => `viewed ${e.patientName ?? "a record"}`,
  },
  assign: {
    icon: UserCog,
    tint: "bg-sky-50 text-sky-700",
    label: (e) => `reassigned ${e.patientName ?? "patient"}`,
  },
  status_change: {
    icon: Workflow,
    tint: "bg-sky-50 text-sky-700",
    label: (e) => {
      const m = e.metadata as { to?: WorkflowStatus; auto?: boolean } | null;
      const label = m?.to ? STATUS_LABELS[m.to] : "updated";
      const auto = m?.auto ? " (auto)" : "";
      return `moved ${e.patientName ?? "patient"} → ${label}${auto}`;
    },
  },
  sign_in: {
    icon: LogIn,
    tint: "bg-emerald-50 text-emerald-700",
    label: () => `signed in`,
  },
  sign_out: {
    icon: LogOut,
    tint: "bg-muted text-muted-foreground",
    label: () => `signed out`,
  },
  bulk_archive: {
    icon: Archive,
    tint: "bg-muted text-muted-foreground",
    label: (e) => {
      const m = e.metadata as { count?: number } | null;
      return `archived ${m?.count ?? "several"} patients`;
    },
  },
  bulk_status: {
    icon: Workflow,
    tint: "bg-sky-50 text-sky-700",
    label: (e) => {
      const m = e.metadata as { count?: number; status?: WorkflowStatus } | null;
      const label = m?.status ? STATUS_LABELS[m.status] : "updated";
      return `moved ${m?.count ?? "several"} patients → ${label}`;
    },
  },
  automation_fire: {
    icon: Wand2,
    tint: "bg-indigo-50 text-indigo-700",
    label: (e) => {
      const m = e.metadata as { rule?: string; reason?: string } | null;
      return `automation · ${m?.rule ?? "rule fired"}${m?.reason ? ` — ${m.reason}` : ""}`;
    },
  },
  summary_refresh: {
    icon: Brain,
    tint: "bg-accent text-accent-foreground",
    label: (e) => `refreshed summary for ${e.patientName ?? "patient"}`,
  },
  copilot_query: {
    icon: Sparkles,
    tint: "bg-accent text-accent-foreground",
    label: (e) => {
      const action = (e.metadata as { action?: string } | null)?.action ?? "query";
      return `ran copilot · ${action}`;
    },
  },
  approval_requested: {
    icon: ScrollText,
    tint: "bg-amber-50 text-amber-800",
    label: (e) => {
      const kind = (e.metadata as { kind?: string } | null)?.kind ?? "approval";
      return `requested approval · ${kind}`;
    },
  },
  approval_decided: {
    icon: ScrollText,
    tint: "bg-indigo-50 text-indigo-700",
    label: (e) => {
      const m = e.metadata as { decision?: string; kind?: string } | null;
      return `${m?.decision ?? "decided"} approval · ${m?.kind ?? ""}`;
    },
  },
  policy_change: {
    icon: ShieldCheck,
    tint: "bg-indigo-50 text-indigo-700",
    label: (e) => {
      const m = e.metadata as { kind?: string; revision?: number } | null;
      return `updated ${m?.kind ?? "policy"} (rev ${m?.revision ?? "?"})`;
    },
  },
  provider_change: {
    icon: Server,
    tint: "bg-indigo-50 text-indigo-700",
    label: (e) => `provider config changed`,
  },
  rule_toggled: {
    icon: Wand2,
    tint: "bg-indigo-50 text-indigo-700",
    label: (e) => {
      const m = e.metadata as { key?: string; enabled?: boolean } | null;
      return `${m?.enabled ? "enabled" : "disabled"} rule ${m?.key ?? ""}`;
    },
  },
  org_switch: {
    icon: Building2,
    tint: "bg-muted text-muted-foreground",
    label: () => `switched organization`,
  },
  simulation_run: {
    icon: Flame,
    tint: "bg-orange-50 text-orange-800",
    label: (e) => {
      const m = e.metadata as { kind?: string; intensity?: number } | null;
      return `ran simulation · ${m?.kind ?? ""} (i=${m?.intensity ?? "?"})`;
    },
  },
  manual_retry: {
    icon: RotateCcw,
    tint: "bg-amber-50 text-amber-800",
    label: () => `retried a queue job`,
  },
  backup_created: {
    icon: Database,
    tint: "bg-emerald-50 text-emerald-700",
    label: (e) => {
      const m = e.metadata as { label?: string; bytes?: number } | null;
      return `captured backup · ${m?.label ?? ""} (${m?.bytes ?? 0}b)`;
    },
  },
  consent_change: {
    icon: ShieldCheck,
    tint: "bg-amber-50 text-amber-800",
    label: (e) => `updated consent for ${e.patientName ?? "patient"}`,
  },
  retention_change: {
    icon: ShieldCheck,
    tint: "bg-amber-50 text-amber-800",
    label: (e) => `updated retention for ${e.patientName ?? "patient"}`,
  },
};

export function ActivityFeed({
  entries,
  title = "Recent activity",
  description = "System-wide events across the workspace.",
  compact = false,
}: {
  entries: ActivityEntry[];
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ActivityIcon className="h-3.5 w-3.5 text-muted-foreground" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <EmptyState title="Quiet for now" description="Activity will appear here as the workspace is used." />
        ) : (
          entries.map((entry) => {
            const m = meta[entry.action];
            const Icon = m.icon;
            const actor = entry.userName ?? entry.performedBy ?? "system";
            const text = m.label(entry);
            return (
              <div key={entry.id} className="flex items-start gap-3">
                <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", m.tint)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{actor}</span>{" "}
                    {entry.patientId && !compact ? (
                      <Link
                        href={`/patients/${entry.patientId}`}
                        className="text-foreground hover:underline"
                      >
                        {text}
                      </Link>
                    ) : (
                      <span>{text}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{relativeTime(entry.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
