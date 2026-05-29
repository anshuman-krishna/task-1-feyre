import type { AutomationTrigger } from "@prisma/client";

export type AutomationActionSpec =
  | { kind: "notify"; priority: "low" | "normal" | "high" | "critical"; channel: "assignee" | "admins" | "requester" }
  | { kind: "escalate_status"; to: "follow_up_needed" | "urgent_review"; onlySoft: boolean }
  | { kind: "refresh_summary" }
  | { kind: "recommend_review" };

export type AutomationContext = {
  trigger: AutomationTrigger;
  patientId: string | null;
  organizationId: string;
  payload: Record<string, unknown>;
};

export type AutomationRule = {
  key: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  actions: AutomationActionSpec[];
  // returns a reason string if the rule should fire, null otherwise.
  // keep this synchronous + side-effect free.
  evaluate(ctx: AutomationContext): string | null;
};

export type AutomationRunResult = {
  ruleKey: string;
  ruleName: string;
  trigger: AutomationTrigger;
  patientId: string | null;
  reason: string;
  actionsFired: string[];
  outcome: Record<string, unknown>;
};
