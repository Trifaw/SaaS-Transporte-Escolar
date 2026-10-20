import { dbStore, type RealtimeBroadcastPayload } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') || '*';

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream closed
        }
      };

      sendEvent({
        channel,
        event: 'connected',
        publishedAt: new Date().toISOString(),
      });

      unsubscribe = dbStore.subscribeRealtime(
        channel,
        (msg: RealtimeBroadcastPayload) => {
          sendEvent(msg);
        }
      );

      request.signal.addEventListener('abort', () => {
        if (unsubscribe) unsubscribe();
      });
    },
    cancel() {
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
