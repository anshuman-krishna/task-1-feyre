// in-memory counters. survives the process; resets on restart.
// real metrics (prometheus / otel) drop in behind the same interface.

type CounterKey = string;
type SummaryKey = string;

const counters = new Map<CounterKey, number>();
const summaries = new Map<SummaryKey, { count: number; total: number; max: number }>();

export const metrics = {
  inc(name: string, labels?: Record<string, string>, by = 1) {
    const key = labelize(name, labels);
    counters.set(key, (counters.get(key) ?? 0) + by);
  },
  observe(name: string, value: number, labels?: Record<string, string>) {
    const key = labelize(name, labels);
    const s = summaries.get(key) ?? { count: 0, total: 0, max: 0 };
    s.count += 1;
    s.total += value;
    if (value > s.max) s.max = value;
    summaries.set(key, s);
  },
  snapshot() {
    return {
      counters: Object.fromEntries(counters),
      summaries: Object.fromEntries(
        Array.from(summaries.entries()).map(([k, v]) => [
          k,
          { count: v.count, avg: v.total / v.count, max: v.max },
        ]),
      ),
    };
  },
  reset() {
    counters.clear();
    summaries.clear();
  },
};

function labelize(name: string, labels?: Record<string, string>) {
  if (!labels) return name;
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  return `${name}{${parts}}`;
}
