"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, Brain, Activity, User as UserIcon } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { useDebounce } from "@/hooks/use-debounce";

type Hit = {
  kind: "patient" | "note" | "summary" | "observation";
  patientId: string;
  patientName: string;
  title: string;
  snippet: string;
  score: number;
};

const iconFor: Record<Hit["kind"], React.ElementType> = {
  patient: UserIcon,
  note: FileText,
  summary: Brain,
  observation: Activity,
};

const labelFor: Record<Hit["kind"], string> = {
  patient: "Patient",
  note: "Note",
  summary: "Summary",
  observation: "Signal",
};

export function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQ = useDebounce(q, 200);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["search", debouncedQ],
    queryFn: () =>
      fetcher<{ query: string; hits: Hit[] }>(
        `/api/search?q=${encodeURIComponent(debouncedQ)}&limit=10`,
      ),
    enabled: debouncedQ.trim().length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showResults = open && debouncedQ.trim().length >= 2;
  const hits = data?.hits ?? [];

  return (
    <div ref={ref} className="relative flex max-w-md flex-1 items-center">
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search patients, notes, observations…"
        className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Search"
      />
      {showResults && (
        <div className="absolute left-0 right-0 top-11 z-40 max-h-96 overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">No matches.</p>
          ) : (
            <ul className="divide-y divide-border">
              {hits.map((h, i) => {
                const Icon = iconFor[h.kind];
                return (
                  <li key={i}>
                    <Link
                      href={`/patients/${h.patientId}`}
                      className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60"
                      onClick={() => setOpen(false)}
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          {h.title}
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                            {labelFor[h.kind]}
                          </span>
                        </p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{h.snippet}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
