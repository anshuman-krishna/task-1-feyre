"use client";

import Link from "next/link";
import { Archive, MoreHorizontal, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRunPrediction } from "../queries";

export function PatientRowActions({ id, onArchive }: { id: string; onArchive: () => void }) {
  const run = useRunPrediction();

  const onPredict = async () => {
    try {
      await run.mutateAsync(id);
      toast.success("Prediction updated");
    } catch (err) {
      toast.error("Prediction failed", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Patient actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/patients/${id}`}>
            <Pencil className="h-3.5 w-3.5" /> Open
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={onPredict}>
          <Sparkles className="h-3.5 w-3.5" /> Run prediction
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={onArchive}
          className="text-destructive focus:bg-red-50"
        >
          <Archive className="h-3.5 w-3.5" /> Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
