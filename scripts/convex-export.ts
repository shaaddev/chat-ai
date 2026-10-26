import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type ConvexDoc = Record<string, unknown> & { _id: string };

export interface ConvexExport {
  accounts: ConvexDoc[];
  chats: ConvexDoc[];
  messages: ConvexDoc[];
  sessions: ConvexDoc[];
  streams: ConvexDoc[];
  users: ConvexDoc[];
  verifications: ConvexDoc[];
}

function readTable(dir: string, table: string): ConvexDoc[] {
  const file = join(dir, table, "documents.jsonl");
  if (!existsSync(file)) {
    return [];
  }
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ConvexDoc);
}

/** Reads an unzipped `convex export` snapshot directory. */
export function readConvexExport(dir: string): ConvexExport {
  if (!existsSync(join(dir, "_tables"))) {
    throw new Error(`${dir} is not an unzipped convex export`);
  }
  const auth = "_components/betterAuth";
  return {
    users: readTable(dir, `${auth}/user`),
    sessions: readTable(dir, `${auth}/session`),
    accounts: readTable(dir, `${auth}/account`),
    verifications: readTable(dir, `${auth}/verification`),
    chats: readTable(dir, "chats"),
    messages: readTable(dir, "messages"),
    streams: readTable(dir, "streams"),
  };
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Set DATABASE_URL to the target database. The scripts never read NEON_DB, so they cannot write to production by accident."
    );
  }
  return url;
}

export function describeTarget(url: string): string {
  const { hostname, pathname } = new URL(url);
  return `${hostname}${pathname}`;
}
