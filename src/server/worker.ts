import { processNextJob } from "@/services/queue/prediction";
import { log } from "./logger";

const TICK_MS = 1500;
const BURST = 5;

const g = globalThis as unknown as { __miraWorkerStarted?: boolean };

export function ensureWorker() {
  if (g.__miraWorkerStarted) return;
  g.__miraWorkerStarted = true;
  log.info("worker.start", { tickMs: TICK_MS });

  const tick = async () => {
    try {
      // process up to BURST jobs per tick so a backlog drains quickly
      for (let i = 0; i < BURST; i++) {
        const handled = await processNextJob();
        if (!handled) break;
      }
    } catch (err) {
      log.error("worker.tick.failed", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // never block the event loop forever; unref() lets the process exit
  const id = setInterval(tick, TICK_MS);
  // node typings differ between Node and Bun; unref exists on Node's Timeout
  (id as unknown as { unref?: () => void }).unref?.();

  // first tick on next microtask so any race with importers settles
  setImmediate(tick);
}
