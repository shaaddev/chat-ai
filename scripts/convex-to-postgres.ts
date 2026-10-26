import { and, eq, inArray, lt, sql } from "drizzle-orm";
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
  createdAfter,
  describeTarget,
  parseSince,
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

function planImport(
  snapshot: ConvexExport,
  now: Date,
  since: number | undefined
) {
  const fresh = (doc: Doc) => createdAfter(doc, since);
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

  const accounts = snapshot.accounts.filter(fresh).map((doc) => ({
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
    (doc) =>
      field<number>(doc, "expiresAt", "number") > now.getTime() && fresh(doc)
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
    (doc) =>
      field<number>(doc, "expiresAt", "number") > now.getTime() && fresh(doc)
  );
  const verifications = liveVerifications.map((doc) => ({
    id: doc._id,
    identifier: field<string>(doc, "identifier", "string"),
    value: field<string>(doc, "value", "string"),
    expiresAt: date(doc, "expiresAt"),
    createdAt: date(doc, "createdAt"),
    updatedAt: date(doc, "updatedAt"),
  }));

  const chatIdByConvexId = new Map<string, string>();
  const freshChatIds = new Set<string>();
  const chats = snapshot.chats.map((doc) => {
    const id = field<string>(doc, "clientId", "string");
    if ([...chatIdByConvexId.values()].includes(id)) {
      throw new Error(`duplicate chat clientId ${id}`);
    }
    chatIdByConvexId.set(doc._id, id);
    if (fresh(doc)) {
      freshChatIds.add(id);
    }
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

  const messages = snapshot.messages.filter(fresh).map((doc) => {
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
    newChats: chats.filter((c) => freshChatIds.has(c.id)),
    existingChats: chats.filter((c) => !freshChatIds.has(c.id)),
    messages,
    skipped: {
      expiredOrOlderSessions: snapshot.sessions.length - liveSessions.length,
      expiredOrOlderVerifications:
        snapshot.verifications.length - liveVerifications.length,
      messagesBeforeSince: snapshot.messages.length - messages.length,
      streams: snapshot.streams.length,
    },
  };
}

const MESSAGE_BATCH = 100;

async function main() {
  const [, , dir] = process.argv;
  if (!dir || dir.startsWith("--")) {
    console.error(
      "usage: bun scripts/convex-to-postgres.ts <export-dir> [--since=<ms>]"
    );
    process.exit(2);
  }
  const url = requireDatabaseUrl();
  const since = parseSince(process.argv.slice(3));
  const plan = planImport(readConvexExport(dir), new Date(), since);
  console.log(
    `target ${describeTarget(url)}${since ? `, since ${new Date(since).toISOString()}` : ""}`
  );

  const client = postgres(url, { max: 1 });
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
      messagesOfDeletedChats: 0,
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
    for (const row of plan.existingChats) {
      // biome-ignore lint/performance/noAwaitInLoops: a transaction runs on one connection, so statements go in order anyway
      const updated = await tx
        .update(chat)
        .set({
          title: row.title,
          visibility: row.visibility,
          systemPrompt: row.systemPrompt,
          updatedAt: row.updatedAt,
        })
        .where(and(eq(chat.id, row.id), lt(chat.updatedAt, row.updatedAt)))
        .returning({ id: chat.id });
      count.chats += updated.length;
    }
    if (plan.newChats.length > 0) {
      const rows = await tx
        .insert(chat)
        .values(plan.newChats)
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
      count.chats += rows.length;
    }
    const chatIds = [...new Set(plan.messages.map((m) => m.chatId))];
    const present = new Set(
      chatIds.length === 0
        ? []
        : (
            await tx
              .select({ id: chat.id })
              .from(chat)
              .where(inArray(chat.id, chatIds))
          ).map((row) => row.id)
    );
    const messages = plan.messages.filter((m) => present.has(m.chatId));
    count.messagesOfDeletedChats = plan.messages.length - messages.length;
    for (let i = 0; i < messages.length; i += MESSAGE_BATCH) {
      // biome-ignore lint/performance/noAwaitInLoops: a transaction runs on one connection, so statements go in order anyway
      const rows = await tx
        .insert(message)
        .values(messages.slice(i, i + MESSAGE_BATCH))
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
    newChats: plan.newChats.length,
    existingChats: plan.existingChats.length,
    messages: plan.messages.length,
  });
  console.log("written (inserted or updated)", inserted);
  console.log("skipped", plan.skipped);
}

await main();
