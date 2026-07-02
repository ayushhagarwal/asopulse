import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { FastifyInstance } from "fastify";

const sessions = new Map<string, { username: string; expiresAt: number }>();
let owner: { username: string; passwordHash: string } | undefined;

export async function registerAuth(app: FastifyInstance) {
  app.post<{ Body: { username?: string; password?: string } }>(
    "/api/v1/auth/setup",
    async (request, reply) => {
      if (owner) return reply.code(409).send({ error: "Owner already configured" });
      const { username = "", password = "" } = request.body ?? {};
      if (username.length < 2 || password.length < 10)
        return reply
          .code(400)
          .send({ error: "Use a username and a password of at least 10 characters" });
      owner = { username, passwordHash: await argon2.hash(password, { type: argon2.argon2id }) };
      return reply.code(201).send({ configured: true });
    },
  );

  app.post<{ Body: { username?: string; password?: string } }>(
    "/api/v1/auth/login",
    async (request, reply) => {
      const { username = "", password = "" } = request.body ?? {};
      if (
        !owner ||
        owner.username !== username ||
        !(await argon2.verify(owner.passwordHash, password))
      )
        return reply.code(401).send({ error: "Invalid credentials" });
      const token = randomBytes(32).toString("base64url");
      sessions.set(token, { username, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      reply.setCookie("asopulse_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return { username };
    },
  );

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const token = request.cookies.asopulse_session;
    if (token) sessions.delete(token);
    reply.clearCookie("asopulse_session", { path: "/" });
    return { loggedOut: true };
  });
}
