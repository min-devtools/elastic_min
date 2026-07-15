import test from "node:test";
import assert from "node:assert/strict";
import {
  appendAiEntry,
  createAiSession,
  deleteAiSession,
  loadAiSessionState,
} from "../src/lib/aiSessions.ts";

test("first user message names the session and moves it to the front", () => {
  const older = createAiSession(1, "older");
  const active = createAiSession(2, "active");
  const text = "Tìm tất cả đơn hàng thất bại trong ngày hôm nay";

  const sessions = appendAiEntry(
    [active, older],
    "older",
    { role: "user", text },
    3,
  );

  assert.equal(sessions[0].id, "older");
  assert.equal(sessions[0].title, `${text.slice(0, 39)}…`);
  assert.equal(sessions[0].entries[0].text, text);
});

test("only the ten most recently updated sessions are retained", () => {
  const sessions = Array.from({ length: 11 }, (_, i) => createAiSession(i, `s-${i}`));

  const result = appendAiEntry(sessions, "s-10", { role: "user", text: "latest" }, 20);

  assert.equal(result.length, 10);
  assert.equal(result[0].id, "s-10");
  assert.equal(result.some((session) => session.id === "s-0"), false);
});

test("malformed persisted data falls back to one empty session", () => {
  const state = loadAiSessionState("not json", 5, () => "fresh");

  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].id, "fresh");
  assert.equal(state.activeSessionId, "fresh");
});

test("deleting the final session creates and activates a replacement", () => {
  const only = createAiSession(1, "only");

  const state = deleteAiSession([only], "only", "only", 2, () => "replacement");

  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].id, "replacement");
  assert.equal(state.activeSessionId, "replacement");
});

test("persisted sessions are validated, sorted, capped, and keep a valid active id", () => {
  const sessions = Array.from({ length: 11 }, (_, i) => ({
    id: `s-${i}`,
    title: `Chat ${i}`,
    createdAt: i,
    updatedAt: i,
    entries: [{ role: "assistant", text: String(i) }],
  }));
  sessions.push({ id: "bad", title: 3, createdAt: 0, updatedAt: 99, entries: [] });

  const state = loadAiSessionState(
    JSON.stringify({ sessions, activeSessionId: "s-4" }),
    20,
    () => "fresh",
  );

  assert.equal(state.sessions.length, 10);
  assert.equal(state.sessions[0].id, "s-10");
  assert.equal(state.activeSessionId, "s-4");
  assert.equal(state.sessions.some((session) => session.id === "bad"), false);
});
