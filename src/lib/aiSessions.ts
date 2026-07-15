import type { GeneratedQuery } from "./ai";

export const AI_SESSION_CAP = 10;

export interface AiChatEntry {
  role: "user" | "assistant";
  text: string;
  query?: GeneratedQuery;
  error?: boolean;
}

export interface AiChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  entries: AiChatEntry[];
}

export interface AiSessionState {
  sessions: AiChatSession[];
  activeSessionId: string;
}

export function createAiSession(
  now = Date.now(),
  id = crypto.randomUUID(),
): AiChatSession {
  return { id, title: "New chat", createdAt: now, updatedAt: now, entries: [] };
}

function titleFrom(text: string): string {
  const title = text.trim().replace(/\s+/g, " ");
  return title.length > 40 ? `${title.slice(0, 39)}…` : title || "New chat";
}

export function appendAiEntry(
  sessions: AiChatSession[],
  sessionId: string,
  entry: AiChatEntry,
  now = Date.now(),
): AiChatSession[] {
  return sessions
    .map((session) =>
      session.id === sessionId
        ? {
            ...session,
            title:
              session.entries.length === 0 && entry.role === "user"
                ? titleFrom(entry.text)
                : session.title,
            updatedAt: now,
            entries: [...session.entries, entry],
          }
        : session,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, AI_SESSION_CAP);
}

function validEntry(value: unknown): value is AiChatEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<AiChatEntry>;
  return (entry.role === "user" || entry.role === "assistant") && typeof entry.text === "string";
}

function validSession(value: unknown): value is AiChatSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<AiChatSession>;
  return (
    typeof session.id === "string" &&
    typeof session.title === "string" &&
    typeof session.createdAt === "number" &&
    typeof session.updatedAt === "number" &&
    Array.isArray(session.entries) &&
    session.entries.every(validEntry)
  );
}

export function loadAiSessionState(
  raw: string | null,
  now = Date.now(),
  createId = () => crypto.randomUUID(),
): AiSessionState {
  try {
    const stored = JSON.parse(raw ?? "null") as { sessions?: unknown; activeSessionId?: unknown } | null;
    const sessions = Array.isArray(stored?.sessions)
      ? stored.sessions
          .filter(validSession)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, AI_SESSION_CAP)
      : [];
    if (sessions.length) {
      const activeSessionId =
        typeof stored?.activeSessionId === "string" &&
        sessions.some((session) => session.id === stored.activeSessionId)
          ? stored.activeSessionId
          : sessions[0].id;
      return { sessions, activeSessionId };
    }
  } catch {
    // Fall through to a fresh conversation.
  }
  const session = createAiSession(now, createId());
  return { sessions: [session], activeSessionId: session.id };
}

export function deleteAiSession(
  sessions: AiChatSession[],
  sessionId: string,
  activeSessionId: string,
  now = Date.now(),
  createId = () => crypto.randomUUID(),
): AiSessionState {
  const remaining = sessions.filter((session) => session.id !== sessionId);
  if (!remaining.length) {
    const session = createAiSession(now, createId());
    return { sessions: [session], activeSessionId: session.id };
  }
  return {
    sessions: remaining,
    activeSessionId:
      activeSessionId === sessionId || !remaining.some((session) => session.id === activeSessionId)
        ? remaining[0].id
        : activeSessionId,
  };
}
