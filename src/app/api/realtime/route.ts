import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isRealtimeEnabled, systemEventBus, type SystemEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isRealtimeEnabled()) {
    return new Response(JSON.stringify({ enabled: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connect greeting
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", time: Date.now() })}\n\n`));

      const onEvent = (event: SystemEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          cleanup?.();
        }
      };

      systemEventBus.on("change", onEvent);

      // Keep-alive ping every 25 seconds (prevents proxies, Nginx, Render, Fly from killing the stream)
      const timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup?.();
        }
      }, 25000);

      cleanup = () => {
        systemEventBus.off("change", onEvent);
        clearInterval(timer);
      };

      req.signal.addEventListener("abort", () => {
        cleanup?.();
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
