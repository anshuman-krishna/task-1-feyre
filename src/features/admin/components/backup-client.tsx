"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";

type Snapshot = {
  id: string;
  label: string;
  kind: string;
  bytes: number;
  createdAt: string;
};

export function BackupClient({ snapshots }: { snapshots: Snapshot[] }) {
  const [rows, setRows] = useState(snapshots);
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    setBusy(true);
    try {
      const created = await fetcher<Snapshot>("/api/admin/backups", { method: "POST" });
      setRows((r) => [{ ...created, createdAt: new Date(created.createdAt).toLocaleString() }, ...r]);
      toast.success("Snapshot created");
    } catch (err) {
      toast.error("Backup failed", {
        description: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onCreate} disabled={busy}>
          {busy ? "Capturing…" : "Capture snapshot"}
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No snapshots yet.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">Label</th>
              <th className="py-1 text-left font-medium">Kind</th>
              <th className="py-1 text-right font-medium">Bytes</th>
              <th className="py-1 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="py-1.5">{s.label}</td>
                <td className="py-1.5 text-muted-foreground">{s.kind}</td>
                <td className="py-1.5 text-right font-mono">{s.bytes}</td>
                <td className="py-1.5 text-muted-foreground">{s.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
