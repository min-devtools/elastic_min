import { useEffect, useRef, useState } from "react";
import { ToolButton } from "../ui/ToolButton";
import { Icon } from "../ui/Icon";
import { JsonView } from "../ui/JsonView";
import { useApp } from "../store";
import { useActiveConnection, useIndices, useMappingFields } from "../lib/queries";
import {
  applyGeneratedQuery,
  askAi,
  buildSystemPrompt,
  parseGeneratedQuery,
  type ChatMsg,
} from "../lib/ai";

export function AiChat() {
  const conn = useActiveConnection();
  const indices = useIndices();
  const activeIndex = useApp((s) => s.activeIndex);
  const aiProvider = useApp((s) => s.aiProvider);
  const openTab = useApp((s) => s.openTab);
  const showToast = useApp((s) => s.showToast);
  const aiSessions = useApp((s) => s.aiSessions);
  const activeAiSessionId = useApp((s) => s.activeAiSessionId);
  const newAiSession = useApp((s) => s.newAiSession);
  const setActiveAiSession = useApp((s) => s.setActiveAiSession);
  const appendAiEntry = useApp((s) => s.appendAiEntry);
  const deleteAiSession = useApp((s) => s.deleteAiSession);
  const mapping = useMappingFields(activeIndex);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSession =
    aiSessions.find((session) => session.id === activeAiSessionId) ?? aiSessions[0];
  const entries = activeSession?.entries ?? [];

  const configured = !!aiProvider.apiKey && !!aiProvider.endpoint && !!aiProvider.model;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries, busy]);

  const send = async () => {
    const question = input.trim();
    if (!question || busy || !configured || !activeSession) return;
    const sessionId = activeSession.id;
    setInput("");
    const history = [...entries, { role: "user" as const, text: question }];
    appendAiEntry(sessionId, { role: "user", text: question });
    setBusy(true);
    try {
      const system = buildSystemPrompt(indices.data ?? [], activeIndex, mapping.data ?? []);
      const messages: ChatMsg[] = [
        { role: "system", content: system },
        ...history.slice(-8).map((e) => ({
          role: e.role,
          content: e.role === "assistant" && e.query ? JSON.stringify(e.query) : e.text,
        })),
      ];
      const reply = await askAi(messages);
      const gen = parseGeneratedQuery(reply);
      if (gen) {
        applyGeneratedQuery(gen);
        showToast("Query generated", `${gen.method} ${gen.path} loaded into the Query editor.`);
        appendAiEntry(sessionId, {
          role: "assistant",
          text: gen.note ?? "Query applied to the editor.",
          query: gen,
        });
      } else {
        appendAiEntry(sessionId, { role: "assistant", text: reply });
      }
    } catch (err) {
      appendAiEntry(sessionId, { role: "assistant", text: String(err), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-chat">
      <div className="ai-session-bar">
        <select
          className="ai-session-select"
          aria-label="AI chat session"
          value={activeSession?.id ?? ""}
          onChange={(e) => setActiveAiSession(e.target.value)}
        >
          {aiSessions.map((session) => (
            <option key={session.id} value={session.id}>{session.title}</option>
          ))}
        </select>
        <ToolButton
          iconOnly
          title="New chat"
          aria-label="New chat"
          disabled={busy}
          onClick={newAiSession}
        >
          <Icon name="plus" />
        </ToolButton>
        <ToolButton
          iconOnly
          title="Delete chat"
          aria-label="Delete chat"
          disabled={busy}
          onClick={() => activeSession && deleteAiSession(activeSession.id)}
        >
          <Icon name="trash" />
        </ToolButton>
      </div>
      <div className="ai-messages" ref={scrollRef}>
        {entries.length === 0 && (
          <div className="ai-hint">
            <strong>AI query assistant</strong>
            <span>
              Describe the query in plain language — it lands in the open Query tab
              (a new one is created if none is open).
            </span>
            <code>tìm user_id là "min" trong index orders, sort theo created_at giảm dần</code>
            {!configured && (
              <ToolButton onClick={() => openTab("settings")}>
                <Icon name="settings" /> Configure AI provider…
              </ToolButton>
            )}
            {configured && !conn && <span>Connect to a cluster first for index context.</span>}
          </div>
        )}
        {entries.map((e, i) => (
          <div key={i} className={`ai-msg ${e.role}${e.error ? " error" : ""}`}>
            <div className="ai-bubble">
              <span>{e.text}</span>
              {e.query && (
                <>
                  <JsonView
                    className="ai-query json-tree"
                    value={{ method: e.query.method, path: e.query.path, body: e.query.body }}
                  />
                  <div className="seg">
                    <ToolButton
                      title="Load this query into the Query editor again"
                      onClick={() => {
                        applyGeneratedQuery(e.query!);
                        showToast("Query applied", `${e.query!.method} ${e.query!.path}`);
                      }}
                    >
                      <Icon name="arrow-right" /> Apply again
                    </ToolButton>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="ai-msg assistant">
            <div className="ai-bubble ai-thinking">thinking…</div>
          </div>
        )}
      </div>
      <div className="ai-input-row">
        <textarea
          className="ai-input"
          rows={2}
          placeholder={
            configured
              ? `Ask about ${activeIndex ?? "your data"}… (Enter to send, Shift+Enter for newline)`
              : "Set endpoint, API key and model in Settings → AI Provider first"
          }
          value={input}
          disabled={!configured || busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <ToolButton
          variant="primary"
          iconOnly
          title="Send (Enter)"
          aria-label="Send"
          disabled={!configured || busy || !input.trim()}
          onClick={() => void send()}
        >
          <Icon name="arrow-right" />
        </ToolButton>
      </div>
    </div>
  );
}
