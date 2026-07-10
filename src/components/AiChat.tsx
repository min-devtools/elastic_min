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
  type GeneratedQuery,
} from "../lib/ai";

interface ChatEntry {
  role: "user" | "assistant";
  text: string;
  query?: GeneratedQuery;
  error?: boolean;
}

export function AiChat() {
  const conn = useActiveConnection();
  const indices = useIndices();
  const { activeIndex, aiProvider, openTab, showToast } = useApp();
  const mapping = useMappingFields(activeIndex);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const configured = !!aiProvider.apiKey && !!aiProvider.endpoint && !!aiProvider.model;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries, busy]);

  const send = async () => {
    const question = input.trim();
    if (!question || busy || !configured) return;
    setInput("");
    const history = [...entries, { role: "user" as const, text: question }];
    setEntries(history);
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
        setEntries((prev) => [
          ...prev,
          { role: "assistant", text: gen.note ?? "Query applied to the editor.", query: gen },
        ]);
      } else {
        setEntries((prev) => [...prev, { role: "assistant", text: reply }]);
      }
    } catch (err) {
      setEntries((prev) => [...prev, { role: "assistant", text: String(err), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-chat">
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
          title="Send (Enter)"
          disabled={!configured || busy || !input.trim()}
          onClick={() => void send()}
        >
          <Icon name="arrow-right" />
        </ToolButton>
      </div>
    </div>
  );
}
