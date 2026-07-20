import assert from "node:assert/strict";
import test from "node:test";
import { connTabId, pickConnTab, pruneConnTabs } from "./tabs.ts";

const tab = (id, kind, connId) => ({ id, kind, title: id, icon: "query", iconClass: "", connId });
const WELCOME = tab("welcome", "welcome", undefined);

test("a kind opens a separate tab per connection", () => {
  assert.notEqual(connTabId("indexes", "prod"), connTabId("indexes", "local"));
});

test("picking a connection prefers its default view over its other tabs", () => {
  const tabs = [tab("query-1", "query", "prod"), tab("indexes:prod", "indexes", "prod")];
  assert.equal(pickConnTab(tabs, "prod", "indexes"), "indexes:prod");
});

test("picking a connection falls back to whatever of its tabs is open", () => {
  const tabs = [tab("query-1", "query", "prod")];
  assert.equal(pickConnTab(tabs, "prod", "indexes"), "query-1");
});

test("a connection with nothing open reports null so the caller creates a tab", () => {
  assert.equal(pickConnTab([tab("indexes:local", "indexes", "local")], "prod", "indexes"), null);
});

test("another connection's tabs are never offered", () => {
  const tabs = [tab("indexes:local", "indexes", "local"), tab("settings", "settings", undefined)];
  assert.equal(pickConnTab(tabs, "prod", "indexes"), null);
});

test("pruning drops tabs of deleted connections and keeps global ones", () => {
  const tabs = [tab("indexes:gone", "indexes", "gone"), tab("indexes:prod", "indexes", "prod"), WELCOME];
  const out = pruneConnTabs(tabs, "indexes:prod", ["prod"], WELCOME);
  assert.deepEqual(out.tabs.map((t) => t.id), ["indexes:prod", "welcome"]);
  assert.deepEqual(out.dropped.map((t) => t.id), ["indexes:gone"]);
  assert.equal(out.activeTabId, "indexes:prod");
});

test("pruning away the active tab moves the selection to a survivor", () => {
  const tabs = [tab("indexes:gone", "indexes", "gone"), WELCOME];
  assert.equal(pruneConnTabs(tabs, "indexes:gone", [], WELCOME).activeTabId, "welcome");
});

test("pruning every tab still leaves one, so activeTabId stays valid", () => {
  const out = pruneConnTabs([tab("indexes:gone", "indexes", "gone")], "indexes:gone", [], WELCOME);
  assert.deepEqual(out.tabs, [WELCOME]);
  assert.equal(out.activeTabId, "welcome");
});

test("nothing to prune reports null so the store skips the update", () => {
  const tabs = [tab("indexes:prod", "indexes", "prod"), WELCOME];
  assert.equal(pruneConnTabs(tabs, "indexes:prod", ["prod"], WELCOME), null);
});
