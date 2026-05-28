"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type U = { id: string; name: string; email: string; role: string; avatarHue: number };

export function SignInPicker({ users, next }: { users: U[]; next: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const choose = async (u: U) => {
    setPendingId(u.id);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id }),
      });
      if (!res.ok) throw new Error("sign in failed");
      router.replace(next);
      router.refresh();
    } catch (err) {
      toast.error("Sign in failed", {
        description: err instanceof Error ? err.message : "unknown error",
      });
      setPendingId(null);
    }
  };

  if (users.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-foreground">No users found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Run <code className="rounded bg-muted px-1.5 py-0.5">npm run db:seed</code> to create demo accounts.
        </p>
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-border">
      {users.map((u) => (
        <button
          key={u.id}
          onClick={() => choose(u)}
          disabled={pendingId !== null}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
            "hover:bg-muted/60",
            "disabled:opacity-60",
            pendingId === u.id && "bg-muted/60",
          )}
        >
          <Avatar name={u.name} hue={u.avatarHue} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-foreground">
            {u.role}
          </span>
        </button>
      ))}
    </Card>
  );
}
