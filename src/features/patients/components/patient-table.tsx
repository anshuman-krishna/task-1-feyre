"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskBadge } from "@/components/risk-badge";
import { EmptyState } from "@/components/empty-state";
import { ageFromDob, formatDate, initials, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useDebounce } from "@/hooks/use-debounce";
import { useQueryState } from "@/hooks/use-query-state";
import { useArchivePatient, usePatients } from "../queries";
import { PatientRowActions } from "./patient-row-actions";
import type { RiskLevel } from "@prisma/client";

type SortKey = "fullName" | "createdAt" | "lastPredictedAt";

const PAGE_SIZE = 12;

export function PatientTable() {
  const [search, setSearch] = useQueryState("q");
  const [risk, setRisk] = useQueryState("risk");
  const [pageStr, setPage] = useQueryState("page");
  const [input, setInput] = useState(search);
  const debouncedInput = useDebounce(input, 250);

  useEffect(() => {
    if (debouncedInput !== search) {
      setSearch(debouncedInput);
      setPage(null);
    }
  }, [debouncedInput, search, setPage, setSearch]);

  const [sort, setSort] = useState<SortKey>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const page = Math.max(1, Number(pageStr) || 1);
  const filters = {
    q: search || undefined,
    risk: (risk || undefined) as RiskLevel | undefined,
    page,
    sort,
    order,
  };

  const { data, isLoading, isPlaceholderData } = usePatients(filters);
  const archive = useArchivePatient();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (key: SortKey) => {
    if (key === sort) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setOrder("desc");
    }
  };

  const onArchive = async (id: string, name: string) => {
    try {
      await archive.mutateAsync(id);
      toast.success(`${name} archived`);
    } catch (err) {
      toast.error("Could not archive patient", {
        description: err instanceof Error ? err.message : "unknown error",
      });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search name, email, or condition…"
              className="pl-8"
            />
          </div>
          <Select
            value={risk || "all"}
            onValueChange={(v) => {
              setRisk(v === "all" ? null : v);
              setPage(null);
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risk levels</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="elevated">Elevated</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild size="sm">
          <Link href="/patients/new">
            <UserPlus className="h-3.5 w-3.5" /> Add patient
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={<Search className="h-4 w-4" />}
            title={search || risk ? "No patients match this view" : "No patients yet"}
            description={
              search || risk
                ? "Try clearing the search or risk filter."
                : "Add your first patient to start running predictions."
            }
            action={
              !search && !risk ? (
                <Button asChild size="sm">
                  <Link href="/patients/new">
                    <UserPlus className="h-3.5 w-3.5" /> Add patient
                  </Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>
                  <SortHeader
                    label="Patient"
                    active={sort === "fullName"}
                    order={order}
                    onClick={() => toggleSort("fullName")}
                  />
                </TH>
                <TH className="hidden md:table-cell">Age</TH>
                <TH className="hidden lg:table-cell">AI observation</TH>
                <TH>Risk</TH>
                <TH className="hidden md:table-cell">Confidence</TH>
                <TH className="hidden xl:table-cell">
                  <SortHeader
                    label="Last predicted"
                    active={sort === "lastPredictedAt"}
                    order={order}
                    onClick={() => toggleSort("lastPredictedAt")}
                  />
                </TH>
                <TH className="hidden xl:table-cell">
                  <SortHeader
                    label="Created"
                    active={sort === "createdAt"}
                    order={order}
                    onClick={() => toggleSort("createdAt")}
                  />
                </TH>
                <TH className="w-10" />
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id} className={cn(isPlaceholderData && "opacity-60")}>
                  <TD>
                    <Link
                      href={`/patients/${row.id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                        {initials(row.fullName)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {row.fullName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.email}
                        </span>
                      </span>
                    </Link>
                  </TD>
                  <TD className="hidden text-sm text-muted-foreground md:table-cell">
                    {ageFromDob(row.dob)}
                  </TD>
                  <TD className="hidden text-sm text-muted-foreground lg:table-cell">
                    {row.aiPrediction ?? "—"}
                  </TD>
                  <TD>
                    <RiskBadge level={row.riskLevel} />
                  </TD>
                  <TD className="hidden md:table-cell">
                    {row.predictionConfidence != null ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {(row.predictionConfidence * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TD>
                  <TD className="hidden text-xs text-muted-foreground xl:table-cell">
                    {row.lastPredictedAt ? relativeTime(row.lastPredictedAt) : "—"}
                  </TD>
                  <TD className="hidden text-xs text-muted-foreground xl:table-cell">
                    {formatDate(row.createdAt)}
                  </TD>
                  <TD className="text-right">
                    <PatientRowActions
                      id={row.id}
                      onArchive={() => onArchive(row.id, row.fullName)}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages} · {total} {total === 1 ? "patient" : "patients"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(String(page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(String(page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SortHeader({
  label,
  active,
  order,
  onClick,
}: {
  label: string;
  active: boolean;
  order: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      {active &&
        (order === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );
}
