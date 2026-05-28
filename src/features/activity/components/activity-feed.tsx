import Link from "next/link";
import {
  Activity as ActivityIcon,
  Archive,
  ClipboardList,
  FileDown,
  Sparkles,
  Trash2,
  UserPlus,
  Pencil,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

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
    | "view";
  patientId: string | null;
  patientName: string | null;
  performedBy: string | null;
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
    label: (e) => `Patient ${e.patientName ?? "added"} created`,
  },
  update: {
    icon: Pencil,
    tint: "bg-amber-50 text-amber-800",
    label: (e) => `Patient ${e.patientName ?? ""} updated`.trim(),
  },
  archive: {
    icon: Archive,
    tint: "bg-muted text-muted-foreground",
    label: (e) => `${e.patientName ?? "Patient"} archived`,
  },
  restore: {
    icon: Archive,
    tint: "bg-emerald-50 text-emerald-700",
    label: (e) => `${e.patientName ?? "Patient"} restored`,
  },
  predict: {
    icon: Sparkles,
    tint: "bg-accent text-accent-foreground",
    label: (e) => {
      const m = e.metadata as { riskLevel?: string; provider?: string } | null;
      return `AI prediction · ${m?.riskLevel ?? ""}${m?.provider ? ` (${m.provider})` : ""} for ${e.patientName ?? "patient"}`;
    },
  },
  predict_fail: {
    icon: AlertTriangle,
    tint: "bg-red-50 text-red-700",
    label: (e) => `Prediction failed for ${e.patientName ?? "patient"}`,
  },
  note_add: {
    icon: ClipboardList,
    tint: "bg-amber-50 text-amber-800",
    label: (e) => `Note added on ${e.patientName ?? "patient"}`,
  },
  note_remove: {
    icon: Trash2,
    tint: "bg-muted text-muted-foreground",
    label: (e) => `Note removed from ${e.patientName ?? "patient"}`,
  },
  export: {
    icon: FileDown,
    tint: "bg-muted text-muted-foreground",
    label: (e) => `Exported ${e.patientName ?? "record"}`,
  },
  view: {
    icon: Eye,
    tint: "bg-muted text-muted-foreground",
    label: (e) => `Viewed ${e.patientName ?? "record"}`,
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
            const label = m.label(entry);
            return (
              <div key={entry.id} className="flex items-start gap-3">
                <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", m.tint)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  {entry.patientId && !compact ? (
                    <Link
                      href={`/patients/${entry.patientId}`}
                      className="block truncate text-sm text-foreground hover:underline"
                    >
                      {label}
                    </Link>
                  ) : (
                    <p className="truncate text-sm text-foreground">{label}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {entry.performedBy ?? "system"} · {relativeTime(entry.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
