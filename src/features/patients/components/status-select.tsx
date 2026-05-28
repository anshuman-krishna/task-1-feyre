"use client";

import { toast } from "sonner";
import type { WorkflowStatus } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABELS, STATUS_ORDER } from "@/services/workflow";
import { useUpdatePatient } from "../queries";

export function StatusSelect({
  patientId,
  current,
}: {
  patientId: string;
  current: WorkflowStatus;
}) {
  const update = useUpdatePatient();
  return (
    <Select
      value={current}
      onValueChange={async (v) => {
        try {
          await update.mutateAsync({ id: patientId, input: { status: v as WorkflowStatus } });
          toast.success(`Moved to ${STATUS_LABELS[v as WorkflowStatus]}`);
        } catch (err) {
          toast.error("Could not update status", {
            description: err instanceof Error ? err.message : "unknown error",
          });
        }
      }}
      disabled={update.isPending}
    >
      <SelectTrigger className="h-8 w-44 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
