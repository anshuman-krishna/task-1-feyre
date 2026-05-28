// per-provider circuit breaker. cheap, in-memory, observable.
// production drops this behind a shared store; the interface is the same.

import { log } from "@/server/logger";

type State = {
  state: "closed" | "open" | "half";
  failures: number;
  openedAt: number;
  consecutiveSuccess: number;
};

const FAIL_THRESHOLD = 3;
const COOLDOWN_MS = 30_000;
const HALF_OPEN_PROBES = 1;

const circuits = new Map<string, State>();

function get(name: string): State {
  let s = circuits.get(name);
  if (!s) {
    s = { state: "closed", failures: 0, openedAt: 0, consecutiveSuccess: 0 };
    circuits.set(name, s);
  }
  return s;
}

export function recordSuccess(name: string) {
  const s = get(name);
  s.failures = 0;
  s.consecutiveSuccess += 1;
  if (s.state !== "closed" && s.consecutiveSuccess >= HALF_OPEN_PROBES) {
    log.info("circuit.close", { provider: name });
    s.state = "closed";
    s.openedAt = 0;
    s.consecutiveSuccess = 0;
  }
}

export function recordFailure(name: string) {
  const s = get(name);
  s.failures += 1;
  s.consecutiveSuccess = 0;
  if (s.state === "closed" && s.failures >= FAIL_THRESHOLD) {
    log.warn("circuit.open", { provider: name, failures: s.failures });
    s.state = "open";
    s.openedAt = Date.now();
  } else if (s.state === "half") {
    log.warn("circuit.reopen", { provider: name });
    s.state = "open";
    s.openedAt = Date.now();
  }
}

export function isAvailable(name: string): boolean {
  const s = get(name);
  if (s.state === "closed") return true;
  if (s.state === "open" && Date.now() - s.openedAt >= COOLDOWN_MS) {
    log.info("circuit.half_open", { provider: name });
    s.state = "half";
    return true;
  }
  return s.state === "half";
}

export function snapshot() {
  return Object.fromEntries(
    Array.from(circuits.entries()).map(([name, s]) => [
      name,
      {
        state: s.state,
        failures: s.failures,
        openedAt: s.openedAt ? new Date(s.openedAt).toISOString() : null,
      },
    ]),
  );
}
