import type { UserRecord } from "@asopulse/core";
import { type createDatabase, users } from "@asopulse/db";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type DatabaseClient = ReturnType<typeof createDatabase>["db"];

export type AuthStore = {
  createUser(input: { username: string; passwordHash: string }): Promise<UserRecord>;
  findUserById(id: string): Promise<UserRecord | null>;
  findUserByUsername(username: string): Promise<UserRecord | null>;
  hasUsers(): Promise<boolean>;
};

const COOKIE_NAME = "asopulse_session";

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
    signed: true,
  };
}

async function writeSession(reply: FastifyReply, userId: string) {
  reply.setCookie(COOKIE_NAME, userId, sessionCookieOptions());
}

export function buildDatabaseAuthStore(database: DatabaseClient): AuthStore {
  return {
    async createUser(input) {
      const [created] = await database.insert(users).values(input).returning();
      if (!created) throw new Error("Unable to create owner");
      return created;
    },
    async findUserById(id) {
      const [user] = await database.select().from(users).where(eq(users.id, id)).limit(1);
      return user ?? null;
    },
    async findUserByUsername(username) {
      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      return user ?? null;
    },
    async hasUsers() {
      const [user] = await database.select({ id: users.id }).from(users).limit(1);
      return Boolean(user);
    },
  };
}

export async function readSessionUser(
  request: FastifyRequest,
  store: AuthStore,
): Promise<UserRecord | null> {
  const cookie = request.cookies[COOKIE_NAME];
  if (!cookie) return null;
  const unsigned = request.unsignCookie(cookie);
  if (!unsigned.valid || !unsigned.value) return null;
  return store.findUserById(unsigned.value);
}

export async function requireSessionUser(
  request: FastifyRequest,
  reply: FastifyReply,
  store: AuthStore,
): Promise<UserRecord | null> {
  const user = await readSessionUser(request, store);
  if (!user) {
    await reply.code(401).send({ error: "Authentication required" });
    return null;
  }
  return user;
}

export async function registerAuth(app: FastifyInstance, { store }: { store: AuthStore }) {
  app.get("/api/v1/auth/session", async (request) => {
    const user = await readSessionUser(request, store);
    return {
      configured: await store.hasUsers(),
      authenticated: Boolean(user),
      user: user ? { id: user.id, username: user.username } : null,
    };
  });

  app.post<{ Body: { username?: string; password?: string } }>(
    "/api/v1/auth/setup",
    async (request, reply) => {
      if (await store.hasUsers())
        return reply.code(409).send({ error: "Owner already configured" });
      const { username = "", password = "" } = request.body ?? {};
      if (username.length < 2 || password.length < 10) {
        return reply
          .code(400)
          .send({ error: "Use a username and a password of at least 10 characters" });
      }
      const user = await store.createUser({
        username,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      });
      await writeSession(reply, user.id);
      return reply
        .code(201)
        .send({ configured: true, user: { id: user.id, username: user.username } });
    },
  );

  app.post<{ Body: { username?: string; password?: string } }>(
    "/api/v1/auth/login",
    async (request, reply) => {
      const { username = "", password = "" } = request.body ?? {};
      const user = await store.findUserByUsername(username);
      if (!user || !(await argon2.verify(user.passwordHash, password))) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }
      await writeSession(reply, user.id);
      return { user: { id: user.id, username: user.username } };
    },
  );

  app.post("/api/v1/auth/logout", async (_request, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { loggedOut: true };
  });
}
