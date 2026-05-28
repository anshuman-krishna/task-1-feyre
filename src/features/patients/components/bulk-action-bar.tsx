"use client";

import { Archive, Workflow, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABELS, STATUS_ORDER } from "@/services/workflow";
import type { WorkflowStatus } from "@prisma/client";
import { useBulkPatientAction } from "../queries";

export function BulkActionBar({
  selected,
  onClear,
}: {
  selected: string[];
  onClear: () => void;
}) {
  const bulk = useBulkPatientAction();

  if (selected.length === 0) return null;

  const archive = async () => {
    try {
      const res = await bulk.mutateAsync({ action: "archive", ids: selected });
      toast.success(`Archived ${res.count} ${res.count === 1 ? "patient" : "patients"}`);
      onClear();
    } catch (err) {
      toast.error("Bulk archive failed", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    }
  };

  const changeStatus = async (status: WorkflowStatus) => {
    try {
      const res = await bulk.mutateAsync({ action: "status", ids: selected, status });
      toast.success(`Moved ${res.count} patients → ${STATUS_LABELS[status]}`);
      onClear();
    } catch (err) {
      toast.error("Bulk status update failed", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    }
  };

  return (
    <div className="sticky bottom-4 z-30 mx-auto flex w-fit items-center gap-3 rounded-full border border-border bg-surface px-4 py-2 shadow-lg">
      <span className="text-xs font-medium text-foreground">{selected.length} selected</span>
      <Select onValueChange={(v) => changeStatus(v as WorkflowStatus)}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <Workflow className="h-3 w-3" />
          <SelectValue placeholder="Move to status…" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={archive} disabled={bulk.isPending}>
        <Archive className="h-3.5 w-3.5" /> Archive
      </Button>
      <button
        onClick={onClear}
        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Clear selection"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
