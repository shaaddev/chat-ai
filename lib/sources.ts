import type { ChatMessage } from "./types";

export interface Source {
  domain: string;
  id: string;
  snippet?: string;
  title: string;
  url: string;
}

const WWW_PREFIX_REGEX = /^www\./;

function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(WWW_PREFIX_REGEX, "");
  } catch {
    return url;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Pulls source URLs out of an assistant message. Two paths are supported:
 *
 * 1. AI SDK v6 `source-url` (or `source_url`) parts emitted automatically by
 *    providers that surface citations.
 * 2. A custom `data-sources` data part (`type === "data-sources"`) — emitted
 *    by `app/api/chat/route.ts` as a fallback when the OpenRouter `web`
 *    plugin returns annotations that the SDK doesn't surface natively.
 */
export function extractSources(
  message: ChatMessage | null | undefined
): Source[] {
  if (!message || message.role !== "assistant") {
    return [];
  }

  const seen = new Set<string>();
  const sources: Source[] = [];

  const addSource = (raw: {
    url?: string;
    title?: string;
    snippet?: string;
    id?: string;
  }) => {
    const url = raw.url?.trim();
    if (!url || seen.has(url)) {
      return;
    }
    seen.add(url);
    const title = raw.title?.trim() || getDomainFromUrl(url);
    sources.push({
      id: raw.id ?? `src-${sources.length}-${url}`,
      url,
      title,
      domain: getDomainFromUrl(url),
      snippet: raw.snippet,
    });
  };

  for (const part of message.parts ?? []) {
    if (!isRecord(part)) {
      continue;
    }
    const type = asString(part.type);
    if (!type) {
      continue;
    }

    // AI SDK v6 native source part
    if (type === "source-url" || type === "source_url") {
      addSource({
        id: asString(part.id),
        url: asString(part.url) ?? "",
        title:
          asString(part.title) ??
          (isRecord(part.source) ? asString(part.source.title) : undefined),
        snippet: isRecord(part.providerMetadata)
          ? asString(part.providerMetadata.snippet)
          : undefined,
      });
      continue;
    }

    // Fallback custom data part written by the chat route. AI SDK encodes
    // data parts as `data-<name>` with an optional `data` payload — which
    // may arrive as either an object/array or a JSON-stringified string,
    // depending on how it was emitted server-side.
    if (type === "data-sources") {
      let payload: unknown = part.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = null;
        }
      }
      const items = Array.isArray(payload)
        ? payload
        : isRecord(payload) && Array.isArray(payload.sources)
          ? payload.sources
          : [];
      for (const item of items) {
        if (!isRecord(item)) {
          continue;
        }
        addSource({
          id: asString(item.id),
          url: asString(item.url) ?? "",
          title: asString(item.title),
          snippet: asString(item.snippet),
        });
      }
    }
  }

  return sources;
}

/**
 * Returns the Google favicon URL for a given source domain — visual
 * convenience for the sources panel. Falls back to a small generic icon
 * via Google's favicon service.
 */
export function getFaviconUrl(domain: string, size = 32): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
