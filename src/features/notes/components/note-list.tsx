"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { fetcher } from "@/lib/fetcher";
import { relativeTime } from "@/lib/format";

type Note = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

export function NoteList({ patientId, initial }: { patientId: string; initial: Note[] }) {
  const qc = useQueryClient();
  const key = ["notes", patientId] as const;

  const { data: notes = initial } = useQuery({
    queryKey: key,
    queryFn: () => fetcher<Note[]>(`/api/patients/${patientId}/notes`),
    initialData: initial,
  });

  const [draft, setDraft] = useState("");

  const create = useMutation({
    mutationFn: (body: string) =>
      fetcher<Note>(`/api/patients/${patientId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: (note) => {
      qc.setQueryData<Note[]>(key, (prev) => (prev ? [note, ...prev] : [note]));
      qc.invalidateQueries({ queryKey: ["activity", patientId] });
      setDraft("");
      toast.success("Note added");
    },
    onError: (err) =>
      toast.error("Could not add note", {
        description: err instanceof Error ? err.message : "unknown error",
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fetcher<{ id: string }>(`/api/notes/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<Note[]>(key);
      qc.setQueryData<Note[]>(key, (prev) => prev?.filter((n) => n.id !== id) ?? []);
      return { snapshot };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(key, ctx.snapshot);
      toast.error("Could not remove note");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["activity", patientId] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinician notes</CardTitle>
        <CardDescription>Free-form observations attached to this patient.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note — visit summary, follow-up reminder, biomarker context…"
            rows={3}
          />
          <div className="flex items-center justify-end gap-2">
            <span className="text-[11px] text-muted-foreground">{draft.length}/2000</span>
            <Button
              size="sm"
              disabled={create.isPending || draft.trim().length === 0}
              onClick={() => create.mutate(draft.trim())}
            >
              {create.isPending ? "Saving…" : "Save note"}
            </Button>
          </div>
        </div>

        {notes.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-4 w-4" />}
            title="No notes yet"
            description="Notes are a quick way to capture context that doesn't fit in structured fields."
          />
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li
                key={note.id}
                className="group rounded-md border border-border bg-surface p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{note.author}</span>
                  <div className="flex items-center gap-2">
                    <span>{relativeTime(note.createdAt)}</span>
                    <button
                      onClick={() => remove.mutate(note.id)}
                      className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      aria-label="Remove note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
