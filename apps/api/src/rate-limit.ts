import type { FastifyReply, FastifyRequest } from "fastify";

type Window = { count: number; resetAt: number };

const MAX_TRACKED_CLIENTS = 10_000;

/**
 * request.ip is the forwarded client only when the immediate peer is a trusted
 * private or loopback proxy. A direct public client keeps the socket address.
 */
export function clientRateLimitKey(request: FastifyRequest) {
  return request.ip || request.socket.remoteAddress || "unknown";
}

export function createRateLimitGuard({ max, windowMs }: { max: number; windowMs: number }) {
  const clients = new Map<string, Window>();
  return async function rateLimitGuard(request: FastifyRequest, reply: FastifyReply) {
    const now = Date.now();
    for (const [key, entry] of clients) {
      if (entry.resetAt <= now) clients.delete(key);
    }
    while (clients.size > MAX_TRACKED_CLIENTS) {
      const oldest = clients.keys().next().value;
      if (oldest === undefined) break;
      clients.delete(oldest);
    }
    const key = clientRateLimitKey(request);
    const current = clients.get(key);
    const window =
      !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    window.count += 1;
    clients.set(key, window);
    reply.header("x-ratelimit-limit", max);
    reply.header("x-ratelimit-remaining", Math.max(0, max - window.count));
    reply.header("x-ratelimit-reset", Math.ceil(window.resetAt / 1000));
    if (window.count > max) {
      const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
      return reply
        .header("retry-after", retryAfter)
        .code(429)
        .send({ error: "Too many requests", retryAfterSeconds: retryAfter });
    }
  };
}
