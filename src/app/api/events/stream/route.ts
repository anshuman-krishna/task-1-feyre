import { events } from "@/server/events";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// server-sent events. one stream per signed-in user. broadcast-style:
// every domain event lands in every connected client and the client decides
// what to do with it (typically: invalidate a tanstack-query key).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const write = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          /* stream closed */
        }
      };

      // initial comment so the connection settles fast on the client
      write(`: connected ${new Date().toISOString()}\n\n`);

      const unsubscribe = events.subscribe((data, type) => {
        write(`event: ${type}\n`);
        write(`data: ${JSON.stringify(data)}\n\n`);
      });

      // heartbeat every 15s to keep proxies happy
      const heartbeat = setInterval(() => write(`: ping\n\n`), 15_000);
      (heartbeat as unknown as { unref?: () => void }).unref?.();

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
