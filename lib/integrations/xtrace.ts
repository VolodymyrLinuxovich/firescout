/**
 * XTrace adapter for persistent self-revising memory.
 * Falls back to in-memory store when XTRACE_API_KEY is missing.
 */
import { config } from "../config";

const BASE_URL = "https://api.xtrace.ai/v1";

// In-memory fallback
const memMemory: Record<string, Array<{ fact: string; metadata: Record<string, unknown>; ts: string }>> = {};

function memKey(ownerType: "user" | "group", ownerId: string): string {
  return `${ownerType}:${ownerId}`;
}

async function xtFetch(path: string, options?: RequestInit): Promise<unknown> {
  if (!config.xtraceApiKey) throw new Error("XTRACE_API_KEY not set");
  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.xtraceApiKey}`,
      "X-App-Id": config.xtraceAppId,
      ...(options?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`XTrace error ${resp.status}: ${body}`);
  }
  return resp.json();
}

function isAvailable(): boolean {
  return !!config.xtraceApiKey;
}

export async function getUserMemory(userId: string, query: string): Promise<string[]> {
  if (!isAvailable()) {
    const key = memKey("user", userId);
    return (memMemory[key] ?? [])
      .filter(m => m.fact.toLowerCase().includes(query.toLowerCase().split(" ")[0]))
      .map(m => m.fact);
  }
  try {
    const result = await xtFetch(`/memory/query`, {
      method: "POST",
      body: JSON.stringify({ owner_type: "user", owner_id: userId, app_id: config.xtraceAppId, query, limit: 5 }),
    }) as { facts?: string[] };
    return result.facts ?? [];
  } catch {
    return [];
  }
}

export async function getGroupMemory(groupId: string, query: string): Promise<string[]> {
  if (!isAvailable()) {
    const key = memKey("group", groupId);
    return (memMemory[key] ?? [])
      .filter(m => m.fact.toLowerCase().includes(query.toLowerCase().split(" ")[0]))
      .map(m => m.fact);
  }
  try {
    const result = await xtFetch(`/memory/query`, {
      method: "POST",
      body: JSON.stringify({ owner_type: "group", owner_id: groupId, app_id: config.xtraceAppId, query, limit: 5 }),
    }) as { facts?: string[] };
    return result.facts ?? [];
  } catch {
    return [];
  }
}

export async function writeUserMemory(
  userId: string,
  fact: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const key = memKey("user", userId);
  if (!memMemory[key]) memMemory[key] = [];
  memMemory[key].push({ fact, metadata, ts: new Date().toISOString() });

  if (!isAvailable()) return;
  try {
    await xtFetch(`/memory/write`, {
      method: "POST",
      body: JSON.stringify({ owner_type: "user", owner_id: userId, app_id: config.xtraceAppId, fact, metadata }),
    });
  } catch {
    // non-blocking
  }
}

export async function writeGroupMemory(
  groupId: string,
  fact: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const key = memKey("group", groupId);
  if (!memMemory[key]) memMemory[key] = [];
  memMemory[key].push({ fact, metadata, ts: new Date().toISOString() });

  if (!isAvailable()) return;
  try {
    await xtFetch(`/memory/write`, {
      method: "POST",
      body: JSON.stringify({ owner_type: "group", owner_id: groupId, app_id: config.xtraceAppId, fact, metadata }),
    });
  } catch {
    // non-blocking
  }
}

export async function writeArtifact(
  ownerType: "user" | "group",
  ownerId: string,
  artifact: Record<string, unknown>
): Promise<void> {
  const key = memKey(ownerType, ownerId);
  if (!memMemory[key]) memMemory[key] = [];
  memMemory[key].push({
    fact: `Artifact: ${JSON.stringify(artifact)}`,
    metadata: artifact,
    ts: new Date().toISOString(),
  });

  if (!isAvailable()) return;
  try {
    await xtFetch(`/artifacts`, {
      method: "POST",
      body: JSON.stringify({ owner_type: ownerType, owner_id: ownerId, app_id: config.xtraceAppId, artifact }),
    });
  } catch {
    // non-blocking
  }
}

export async function reviseMemory(
  ownerType: "user" | "group",
  ownerId: string,
  newFact: string,
  contradictionHint?: string
): Promise<void> {
  const key = memKey(ownerType, ownerId);
  if (!memMemory[key]) memMemory[key] = [];
  // In-memory: remove contradicted fact if hint provided
  if (contradictionHint) {
    const idx = memMemory[key].findIndex(m => m.fact.includes(contradictionHint));
    if (idx >= 0) memMemory[key].splice(idx, 1);
  }
  memMemory[key].push({ fact: newFact, metadata: { revised: true }, ts: new Date().toISOString() });

  if (!isAvailable()) return;
  try {
    await xtFetch(`/memory/revise`, {
      method: "POST",
      body: JSON.stringify({
        owner_type: ownerType,
        owner_id: ownerId,
        app_id: config.xtraceAppId,
        new_fact: newFact,
        contradiction_hint: contradictionHint,
      }),
    });
  } catch {
    // non-blocking
  }
}

export async function getRecentMemory(
  ownerType: "user" | "group",
  ownerId: string,
  limit = 10
): Promise<string[]> {
  const key = memKey(ownerType, ownerId);
  return (memMemory[key] ?? []).slice(-limit).map(m => m.fact);
}

export { isAvailable as isXtraceAvailable, memMemory as _memMemory };
