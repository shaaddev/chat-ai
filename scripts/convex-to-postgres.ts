/**
 * Copies a Convex export into Postgres. Safe to rerun: rows that exist are
 * left alone, and users and chats are only overwritten by a newer
 * `updatedAt`, so a rerun after cutover never rolls back newer edits.
 *
 *   bunx convex export --prod --path snapshot.zip && unzip snapshot.zip -d snapshot
 *   DATABASE_URL=postgres://... bun scripts/convex-to-postgres.ts snapshot
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  account,
  chat,
  message,
  session,
  user,
  verification,
} from "../lib/db/schema";
import {
  type ConvexExport,
  describeTarget,
  readConvexExport,
  requireDatabaseUrl,
} from "./convex-export";

type Doc = ConvexExport["users"][number];

function field<T>(
  doc: Doc,
  key: string,
  type: "string" | "number" | "boolean"
): T {
  const value = doc[key];
  if (typeof value !== type) {
    throw new Error(`${doc._id}.${key} should be a ${type}, got ${value}`);
  }
  return value as T;
}

function optional(doc: Doc, key: string): string | null {
  const value = doc[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${doc._id}.${key} should be a string, got ${value}`);
  }
  return value;
}

const date = (doc: Doc, key: string) =>
  new Date(field<number>(doc, key, "number"));
const optionalDate = (doc: Doc, key: string) =>
  typeof doc[key] === "number" ? new Date(doc[key]) : null;

function planImport(snapshot: ConvexExport, now: Date) {
  const users = snapshot.users.map((doc) => ({
    id: doc._id,
    name: field<string>(doc, "name", "string"),
    email: field<string>(doc, "email", "string"),
    emailVerified: field<boolean>(doc, "emailVerified", "boolean"),
    image: optional(doc, "image"),
    createdAt: date(doc, "createdAt"),
    updatedAt: date(doc, "updatedAt"),
  }));
  const userIds = new Set(users.map((u) => u.id));
  const requireUser = (doc: Doc) => {
    const userId = field<string>(doc, "userId", "string");
    if (!userIds.has(userId)) {
      throw new Error(`${doc._id} references missing user ${userId}`);
    }
    return userId;
  };

  const accounts = snapshot.accounts.map((doc) => ({
    id: doc._id,
    accountId: field<string>(doc, "accountId", "string"),
    providerId: field<string>(doc, "providerId", "string"),
    userId: requireUser(doc),
    accessToken: optional(doc, "accessToken"),
    refreshToken: optional(doc, "refreshToken"),
    idToken: optional(doc, "idToken"),
    accessTokenExpiresAt: optionalDate(doc, "accessTokenExpiresAt"),
    refreshTokenExpiresAt: optionalDate(doc, "refreshTokenExpiresAt"),
    scope: optional(doc, "scope"),
    password: optional(doc, "password"),
    createdAt: date(doc, "createdAt"),
    updatedAt: date(doc, "updatedAt"),
  }));

  const liveSessions = snapshot.sessions.filter(
    (doc) => field<number>(doc, "expiresAt", "number") > now.getTime()
  );
  const sessions = liveSessions.map((doc) => ({
    id: doc._id,
    token: field<string>(doc, "token", "string"),
    expiresAt: date(doc, "expiresAt"),
    ipAddress: optional(doc, "ipAddress"),
    userAgent: optional(doc, "userAgent"),
    userId: requireUser(doc),
    createdAt: date(doc, "createdAt"),
    updatedAt: date(doc, "updatedAt"),
  }));

  const liveVerifications = snapshot.verifications.filter(
    (doc) => field<number>(doc, "expiresAt", "number") > now.getTime()
  );
  const verifications = liveVerifications.map((doc) => ({
    id: doc._id,
    identifier: field<string>(doc, "identifier", "string"),
    value: field<string>(doc, "value", "string"),
    expiresAt: date(doc, "expiresAt"),
    createdAt: date(doc, "createdAt"),
    updatedAt: date(doc, "updatedAt"),
  }));

  // Chat URLs use the client-generated id, so it becomes the primary key.
  const chatIdByConvexId = new Map<string, string>();
  const chats = snapshot.chats.map((doc) => {
    const id = field<string>(doc, "clientId", "string");
    if ([...chatIdByConvexId.values()].includes(id)) {
      throw new Error(`duplicate chat clientId ${id}`);
    }
    chatIdByConvexId.set(doc._id, id);
    const visibility = field<string>(doc, "visibility", "string");
    if (visibility !== "public" && visibility !== "private") {
      throw new Error(`${doc._id}.visibility is ${visibility}`);
    }
    return {
      id,
      userId: requireUser(doc),
      title: field<string>(doc, "title", "string"),
      visibility: visibility as "public" | "private",
      systemPrompt: optional(doc, "systemPrompt"),
      createdAt: date(doc, "createdAt"),
      updatedAt: date(doc, "updatedAt"),
    };
  });

  const messages = snapshot.messages.map((doc) => {
    const chatId = chatIdByConvexId.get(field<string>(doc, "chatId", "string"));
    if (!chatId) {
      throw new Error(`${doc._id} belongs to a chat missing from the export`);
    }
    const role = field<string>(doc, "role", "string");
    if (role !== "user" && role !== "assistant" && role !== "system") {
      throw new Error(`${doc._id}.role is ${role}`);
    }
    if (!Array.isArray(doc.parts)) {
      throw new Error(`${doc._id}.parts is not an array`);
    }
    // The Postgres schema keeps files as `file` parts only.
    if (Array.isArray(doc.attachments) && doc.attachments.length > 0) {
      throw new Error(`${doc._id} has legacy attachments`);
    }
    return {
      id: doc._id,
      chatId,
      role: role as "user" | "assistant" | "system",
      parts: doc.parts,
      model: optional(doc, "model"),
      createdAt: date(doc, "createdAt"),
    };
  });

  return {
    users,
    accounts,
    sessions,
    verifications,
    chats,
    messages,
    skipped: {
      expiredSessions: snapshot.sessions.length - liveSessions.length,
      expiredVerifications:
        snapshot.verifications.length - liveVerifications.length,
      streams: snapshot.streams.length,
    },
  };
}

const MESSAGE_BATCH = 100;

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: bun scripts/convex-to-postgres.ts <export-dir>");
    process.exit(2);
  }
  const url = requireDatabaseUrl();
  const plan = planImport(readConvexExport(dir), new Date());
  console.log(`target ${describeTarget(url)}`);

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);
  const newer = (table: typeof user | typeof chat) =>
    sql`${table.updatedAt} < excluded.updated_at`;

  const inserted = await db.transaction(async (tx) => {
    const count = {
      users: 0,
      accounts: 0,
      sessions: 0,
      verifications: 0,
      chats: 0,
      messages: 0,
    };
    if (plan.users.length > 0) {
      const rows = await tx
        .insert(user)
        .values(plan.users)
        .onConflictDoUpdate({
          target: user.id,
          set: {
            name: sql`excluded.name`,
            email: sql`excluded.email`,
            emailVerified: sql`excluded.email_verified`,
            image: sql`excluded.image`,
            updatedAt: sql`excluded.updated_at`,
          },
          setWhere: newer(user),
        })
        .returning({ id: user.id });
      count.users = rows.length;
    }
    if (plan.accounts.length > 0) {
      const rows = await tx
        .insert(account)
        .values(plan.accounts)
        .onConflictDoNothing()
        .returning({ id: account.id });
      count.accounts = rows.length;
    }
    if (plan.sessions.length > 0) {
      const rows = await tx
        .insert(session)
        .values(plan.sessions)
        .onConflictDoNothing()
        .returning({ id: session.id });
      count.sessions = rows.length;
    }
    if (plan.verifications.length > 0) {
      const rows = await tx
        .insert(verification)
        .values(plan.verifications)
        .onConflictDoNothing()
        .returning({ id: verification.id });
      count.verifications = rows.length;
    }
    if (plan.chats.length > 0) {
      const rows = await tx
        .insert(chat)
        .values(plan.chats)
        .onConflictDoUpdate({
          target: chat.id,
          set: {
            title: sql`excluded.title`,
            visibility: sql`excluded.visibility`,
            systemPrompt: sql`excluded.system_prompt`,
            updatedAt: sql`excluded.updated_at`,
          },
          setWhere: newer(chat),
        })
        .returning({ id: chat.id });
      count.chats = rows.length;
    }
    for (let i = 0; i < plan.messages.length; i += MESSAGE_BATCH) {
      const rows = await tx
        .insert(message)
        .values(plan.messages.slice(i, i + MESSAGE_BATCH))
        .onConflictDoNothing()
        .returning({ id: message.id });
      count.messages += rows.length;
    }
    return count;
  });

  await client.end();
  console.log("planned", {
    users: plan.users.length,
    accounts: plan.accounts.length,
    sessions: plan.sessions.length,
    verifications: plan.verifications.length,
    chats: plan.chats.length,
    messages: plan.messages.length,
  });
  console.log("written (inserted or updated)", inserted);
  console.log("skipped", plan.skipped);
}

await main();
