import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm space-y-4 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t locate what you were looking for. It may have been archived or moved.
        </p>
        <Button asChild size="sm">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
