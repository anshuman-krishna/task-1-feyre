"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Download, Search, UserPlus } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar } from "@/components/avatar";
import { RiskBadge } from "@/components/risk-badge";
import { WorkflowBadge } from "@/components/workflow-badge";
import { EmptyState } from "@/components/empty-state";
import { ageFromDob, formatDate, initials, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useDebounce } from "@/hooks/use-debounce";
import { useQueryState } from "@/hooks/use-query-state";
import { useArchivePatient, usePatients } from "../queries";
import { PatientRowActions } from "./patient-row-actions";
import { BulkActionBar } from "./bulk-action-bar";
import type { RiskLevel, WorkflowStatus } from "@prisma/client";

type SortKey = "fullName" | "createdAt" | "lastPredictedAt" | "followUpAt";

const PAGE_SIZE = 12;

export function PatientTable() {
  const [search, setSearch] = useQueryState("q");
  const [risk, setRisk] = useQueryState("risk");
  const [status, setStatus] = useQueryState("status");
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const page = Math.max(1, Number(pageStr) || 1);
  const filters = {
    q: search || undefined,
    risk: (risk || undefined) as RiskLevel | undefined,
    status: (status || undefined) as WorkflowStatus | undefined,
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
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="All risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risk</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="elevated">Elevated</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status || "all"}
            onValueChange={(v) => {
              setStatus(v === "all" ? null : v);
              setPage(null);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="urgent_review">Urgent review</SelectItem>
              <SelectItem value="follow_up_needed">Follow-up needed</SelectItem>
              <SelectItem value="monitoring">Monitoring</SelectItem>
              <SelectItem value="new_patient">New</SelectItem>
              <SelectItem value="stable">Stable</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/patients/export">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </a>
          </Button>
          <Button asChild size="sm">
            <Link href="/patients/new">
              <UserPlus className="h-3.5 w-3.5" /> Add patient
            </Link>
          </Button>
        </div>
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
            title={search || risk || status ? "No patients match this view" : "No patients yet"}
            description={
              search || risk || status
                ? "Try clearing the search or filters."
                : "Add your first patient to start running predictions."
            }
            action={
              !search && !risk && !status ? (
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
                <TH className="w-8">
                  <Checkbox
                    checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                    indeterminate={
                      rows.some((r) => selected.has(r.id)) &&
                      !rows.every((r) => selected.has(r.id))
                    }
                    onCheckedChange={(next) => {
                      const all = new Set(selected);
                      if (next) rows.forEach((r) => all.add(r.id));
                      else rows.forEach((r) => all.delete(r.id));
                      setSelected(all);
                    }}
                    aria-label="Select all on page"
                  />
                </TH>
                <TH>
                  <SortHeader
                    label="Patient"
                    active={sort === "fullName"}
                    order={order}
                    onClick={() => toggleSort("fullName")}
                  />
                </TH>
                <TH className="hidden md:table-cell">Status</TH>
                <TH>Risk</TH>
                <TH className="hidden lg:table-cell">Assigned</TH>
                <TH className="hidden md:table-cell">Confidence</TH>
                <TH className="hidden xl:table-cell">
                  <SortHeader
                    label="Follow-up"
                    active={sort === "followUpAt"}
                    order={order}
                    onClick={() => toggleSort("followUpAt")}
                  />
                </TH>
                <TH className="hidden xl:table-cell">
                  <SortHeader
                    label="Last predicted"
                    active={sort === "lastPredictedAt"}
                    order={order}
                    onClick={() => toggleSort("lastPredictedAt")}
                  />
                </TH>
                <TH className="w-10" />
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => {
                const followUpDue =
                  row.followUpAt != null && new Date(row.followUpAt).getTime() <= Date.now();
                return (
                  <TR
                    key={row.id}
                    className={cn(
                      isPlaceholderData && "opacity-60",
                      selected.has(row.id) && "bg-accent/30",
                    )}
                  >
                    <TD className="w-8">
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={(next) => {
                          const all = new Set(selected);
                          if (next) all.add(row.id);
                          else all.delete(row.id);
                          setSelected(all);
                        }}
                        aria-label={`Select ${row.fullName}`}
                      />
                    </TD>
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
                            {ageFromDob(row.dob)} · {row.email}
                          </span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <WorkflowBadge status={row.status} />
                    </TD>
                    <TD>
                      <RiskBadge level={row.riskLevel} />
                    </TD>
                    <TD className="hidden lg:table-cell">
                      {row.assignedTo ? (
                        <span className="flex items-center gap-2">
                          <Avatar
                            name={row.assignedTo.name}
                            hue={row.assignedTo.avatarHue}
                            size={20}
                          />
                          <span className="truncate text-xs text-foreground">
                            {row.assignedTo.name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
                    <TD className="hidden xl:table-cell">
                      {row.followUpAt ? (
                        <span
                          className={cn(
                            "text-xs",
                            followUpDue ? "font-medium text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {followUpDue ? "Due " : ""}
                          {formatDate(row.followUpAt)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD className="hidden text-xs text-muted-foreground xl:table-cell">
                      {row.lastPredictedAt ? relativeTime(row.lastPredictedAt) : "—"}
                    </TD>
                    <TD className="text-right">
                      <PatientRowActions
                        id={row.id}
                        onArchive={() => onArchive(row.id, row.fullName)}
                      />
                    </TD>
                  </TR>
                );
              })}
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

      <BulkActionBar
        selected={Array.from(selected)}
        onClear={() => setSelected(new Set())}
      />
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
