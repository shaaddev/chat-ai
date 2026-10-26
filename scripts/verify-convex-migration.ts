import { isDeepStrictEqual } from "node:util";
import postgres from "postgres";
import {
  createdAfter,
  describeTarget,
  parseSince,
  readConvexExport,
  requireDatabaseUrl,
} from "./convex-export";

const [, , dir] = process.argv;
if (!dir || dir.startsWith("--")) {
  console.error(
    "usage: bun scripts/verify-convex-migration.ts <export-dir> [--since=<ms>]"
  );
  process.exit(2);
}

const snapshot = readConvexExport(dir);
const since = parseSince(process.argv.slice(3));
const url = requireDatabaseUrl();
const db = postgres(url, { max: 1 });
console.log(`target ${describeTarget(url)}`);

const problems: string[] = [];
const deletedAfterCutover = { chats: 0, messages: 0 };
const ms = (value: Date | null) => (value ? value.getTime() : null);

function compare(
  table: string,
  id: string,
  expected: Record<string, unknown>,
  actual: Record<string, unknown>
) {
  for (const [key, want] of Object.entries(expected)) {
    if (!isDeepStrictEqual(actual[key], want)) {
      problems.push(
        `${table} ${id}: ${key} is ${JSON.stringify(actual[key])?.slice(0, 120)}, expected ${JSON.stringify(want)?.slice(0, 120)}`
      );
    }
  }
}

function editedAfterExport(
  row: { updated_at: Date },
  doc: Record<string, unknown>
) {
  return row.updated_at.getTime() > (doc.updatedAt as number);
}

const users = new Map(
  (await db`select * from "user"`).map((row) => [row.id as string, row])
);
for (const doc of snapshot.users) {
  const row = users.get(doc._id);
  if (!row) {
    problems.push(`user ${doc._id}: missing`);
    continue;
  }
  compare(
    "user",
    doc._id,
    { created_at: doc.createdAt },
    { created_at: ms(row.created_at) }
  );
  if (!editedAfterExport(row as { updated_at: Date }, doc)) {
    compare(
      "user",
      doc._id,
      {
        name: doc.name,
        email: doc.email,
        email_verified: doc.emailVerified,
        image: doc.image ?? null,
        updated_at: doc.updatedAt,
      },
      { ...row, updated_at: ms(row.updated_at) }
    );
  }
}

const chats = new Map(
  (await db`select * from chat`).map((row) => [row.id as string, row])
);
const chatIdByConvexId = new Map<string, string>();
for (const doc of snapshot.chats) {
  const id = doc.clientId as string;
  chatIdByConvexId.set(doc._id, id);
  const row = chats.get(id);
  if (!row) {
    if (createdAfter(doc, since)) {
      problems.push(`chat ${id}: missing`);
    } else {
      deletedAfterCutover.chats += 1;
    }
    continue;
  }
  compare(
    "chat",
    id,
    { user_id: doc.userId, created_at: doc.createdAt },
    { user_id: row.user_id, created_at: ms(row.created_at) }
  );
  if (!editedAfterExport(row as { updated_at: Date }, doc)) {
    compare(
      "chat",
      id,
      {
        title: doc.title,
        visibility: doc.visibility,
        system_prompt: doc.systemPrompt ?? null,
        updated_at: doc.updatedAt,
      },
      { ...row, updated_at: ms(row.updated_at) }
    );
  }
}

const messages = new Map(
  (await db`select * from message`).map((row) => [row.id as string, row])
);
for (const doc of snapshot.messages) {
  const row = messages.get(doc._id);
  const chatId = chatIdByConvexId.get(doc.chatId as string);
  if (!row) {
    if (createdAfter(doc, since) && chatId && chats.has(chatId)) {
      problems.push(`message ${doc._id}: missing`);
    } else {
      deletedAfterCutover.messages += 1;
    }
    continue;
  }
  compare(
    "message",
    doc._id,
    {
      chat_id: chatId,
      role: doc.role,
      parts: doc.parts,
      model: doc.model ?? null,
      created_at: doc.createdAt,
    },
    { ...row, created_at: ms(row.created_at) }
  );
}

const accounts = new Map(
  (await db`select * from account`).map((row) => [row.id as string, row])
);
for (const doc of snapshot.accounts.filter((d) => createdAfter(d, since))) {
  const row = accounts.get(doc._id);
  if (!row) {
    problems.push(`account ${doc._id}: missing`);
    continue;
  }
  compare(
    "account",
    doc._id,
    {
      user_id: doc.userId,
      account_id: doc.accountId,
      provider_id: doc.providerId,
      password: doc.password ?? null,
      created_at: doc.createdAt,
    },
    { ...row, created_at: ms(row.created_at) }
  );
}

const liveSessions = snapshot.sessions.filter(
  (doc) => (doc.expiresAt as number) > Date.now() && createdAfter(doc, since)
);
const sessionIds = new Set(
  (await db`select id from session`).map((row) => row.id as string)
);
for (const doc of liveSessions) {
  if (!sessionIds.has(doc._id)) {
    problems.push(`session ${doc._id}: missing`);
  }
}

await db.end();

const exportIds = {
  user: new Set(snapshot.users.map((d) => d._id)),
  chat: new Set(chatIdByConvexId.values()),
  message: new Set(snapshot.messages.map((d) => d._id)),
};
console.log("checked", {
  users: snapshot.users.length,
  chats: snapshot.chats.length,
  messages: snapshot.messages.length,
  accounts: snapshot.accounts.length,
  liveSessions: liveSessions.length,
});
if (since !== undefined) {
  console.log(
    "created before --since and absent from postgres (deleted after cutover)",
    deletedAfterCutover
  );
}
console.log("rows in postgres but not in the export", {
  users: [...users.keys()].filter((id) => !exportIds.user.has(id)).length,
  chats: [...chats.keys()].filter((id) => !exportIds.chat.has(id)).length,
  messages: [...messages.keys()].filter((id) => !exportIds.message.has(id))
    .length,
});
console.log("not migrated by design", {
  expiredSessions: snapshot.sessions.length - liveSessions.length,
  streams: snapshot.streams.length,
});

if (problems.length > 0) {
  console.error(`FAIL: ${problems.length} problems`);
  for (const problem of problems.slice(0, 50)) {
    console.error(`  ${problem}`);
  }
  process.exit(1);
}
console.log("PASS: every exported user, chat, and message matches Postgres");
