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

function readTable(dir: string, table: string, required = false): ConvexDoc[] {
  const file = join(dir, table, "documents.jsonl");
  if (!existsSync(file)) {
    if (required) {
      throw new Error(`${file} is missing from the export`);
    }
    return [];
  }
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ConvexDoc);
}

export function readConvexExport(dir: string): ConvexExport {
  if (!existsSync(join(dir, "_tables"))) {
    throw new Error(`${dir} is not an unzipped convex export`);
  }
  const auth = "_components/betterAuth";
  const users = readTable(dir, `${auth}/user`, true);
  if (users.length === 0) {
    throw new Error(`${dir} has no users, so it is not this app's export`);
  }
  return {
    users,
    sessions: readTable(dir, `${auth}/session`),
    accounts: readTable(dir, `${auth}/account`),
    verifications: readTable(dir, `${auth}/verification`),
    chats: readTable(dir, "chats", true),
    messages: readTable(dir, "messages", true),
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

/**
 * `--since=<ms>` names the time of the export that seeded the database. A
 * rerun with it inserts only documents created after that time, so rows
 * deleted in Postgres after cutover stay deleted.
 */
export function parseSince(args: string[]): number | undefined {
  const arg = args.find((a) => a.startsWith("--since="));
  if (!arg) {
    return;
  }
  const since = Number(arg.slice("--since=".length));
  if (!Number.isFinite(since)) {
    throw new Error(`--since must be epoch milliseconds, got ${arg}`);
  }
  return since;
}

export const createdAfter = (doc: ConvexDoc, since: number | undefined) =>
  since === undefined || (doc._creationTime as number) > since;

export function describeTarget(url: string): string {
  const { hostname, pathname } = new URL(url);
  return `${hostname}${pathname}`;
}
