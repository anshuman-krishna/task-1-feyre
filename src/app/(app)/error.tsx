"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The page hit an unexpected error. The team has been notified.
          </p>
        </div>
        <details className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer text-foreground">Details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px]">
            {error.message}
          </pre>
        </details>
        <Button size="sm" onClick={() => reset()}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
