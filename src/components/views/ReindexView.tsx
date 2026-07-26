import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarLine } from "../../ui/MetricPanel";
import { Badge } from "../../ui/Badge";
import { ToolButton } from "../../ui/ToolButton";
import { FormRow } from "../../ui/FormRow";
import { Icon } from "../../ui/Icon";
import { Combobox } from "../../ui/Combobox";
import { JsonView } from "../../ui/JsonView";
import { Kv } from "../../ui/Kv";
import { useApp } from "../../store";
import { useActiveConnection, useIndices } from "../../lib/queries";
import { esJson, fetchIndices } from "../../lib/es";
import { formatNumber } from "../../lib/format";

interface TaskStatus {
  completed: boolean;
  task?: {
    status?: {
      total?: number;
      created?: number;
      updated?: number;
      deleted?: number;
      version_conflicts?: number;
      batches?: number;
    };
    description?: string;
    running_time_in_nanos?: number;
  };
  error?: unknown;
  response?: { failures?: unknown[]; took?: number; timed_out?: boolean };
}

export function ReindexView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const connections = useApp((s) => s.connections);
  const showToast = useApp((s) => s.showToast);
  const queryClient = useQueryClient();
  const indices = useIndices();

  const [remote, setRemote] = useState(false);
  const [sourceConnId, setSourceConnId] = useState("");
  const [sourceIndex, setSourceIndex] = useState("");
  const [destIndex, setDestIndex] = useState("");
  const [starting, setStarting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const sourceConn = remote ? connections.find((c) => c.id === sourceConnId) ?? null : conn;
  const otherConns = connections.filter((c) => c.id !== conn?.id);

  // remote mode lists the source cluster's indexes — same cache key the sidebar uses
  const remoteIndices = useQuery({
    queryKey: ["indices", sourceConn?.id],
    queryFn: () => fetchIndices(sourceConn!),
    enabled: remote && !!sourceConn,
    staleTime: 10_000,
  });
  const sourceOptions = ((remote ? remoteIndices.data : indices.data) ?? []).map((i) => ({
    value: i.index,
    hint: i.health,
  }));

  const task = useQuery({
    queryKey: ["reindex-task", conn?.id, taskId],
    enabled: !!conn && !!taskId,
    refetchInterval: (q) => ((q.state.data as TaskStatus | undefined)?.completed ? false : 2000),
    queryFn: () => esJson<TaskStatus>(conn!, "GET", `/_tasks/${taskId}`),
  });

  const status = task.data?.task?.status;
  const done = (status?.created ?? 0) + (status?.updated ?? 0) + (status?.deleted ?? 0);
  const total = status?.total ?? 0;
  const percent = total > 0 ? (done / total) * 100 : task.data?.completed ? 100 : 0;
  const failures = task.data?.response?.failures ?? [];
  const taskError = task.data?.error ?? null;

  const start = async () => {
    if (!conn || starting) return;
    if (!sourceIndex.trim() || !destIndex.trim()) {
      showToast("Missing index", "Pick a source index and type a destination name.", "warn");
      return;
    }
    if (remote && !sourceConn) {
      showToast("Missing source cluster", "Pick the connection to pull documents from.", "warn");
      return;
    }
    const body: any = {
      source: { index: sourceIndex.trim(), size: 1000 },
      dest: { index: destIndex.trim() },
    };
    if (remote && sourceConn) {
      body.source.remote = {
        host: sourceConn.endpoint,
        ...(sourceConn.authType === "basic" && sourceConn.username
          ? { username: sourceConn.username, password: sourceConn.password ?? "" }
          : {}),
      };
    }
    setStarting(true);
    try {
      const res = await esJson<{ task: string }>(
        conn,
        "POST",
        "/_reindex?wait_for_completion=false",
        JSON.stringify(body),
      );
      setTaskId(res.task);
      showToast("Reindex started", `Task ${res.task} is running on ${conn.name}.`);
    } catch (err) {
      showToast("Reindex failed to start", String(err), "err");
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    if (!conn || !taskId) return;
    try {
      await esJson(conn, "POST", `/_tasks/${taskId}/_cancel`);
      showToast("Cancel requested", "The task will stop after its current batch.");
    } catch (err) {
      showToast("Cancel failed", String(err), "err");
    }
  };

  const reset = () => {
    setTaskId(null);
    void queryClient.invalidateQueries({ queryKey: ["indices", conn?.id] });
  };

  return (
    <section className={`content connection-view ${active ? "active" : ""}`}>
      <div className="create-head">
        <div>
          <div className="create-kicker">Reindex helper</div>
          <strong>Copy documents into a new index{conn ? ` · runs on ${conn.name}` : ""}</strong>
        </div>
        <div className="seg">
          {taskId && !task.data?.completed && (
            <ToolButton variant="danger" onClick={() => void cancel()}>
              <Icon name="x" /> Cancel task
            </ToolButton>
          )}
          <ToolButton variant="primary" disabled={!conn || starting || (!!taskId && !task.data?.completed)} onClick={() => void start()}>
            <Icon name="reindex" /> {starting ? "Starting…" : "Start reindex"}
          </ToolButton>
        </div>
      </div>
      <div className="create-layout">
        <div className="create-card">
          <h3>Source and destination</h3>
          <div className="create-form">
            <FormRow label="Source">
              <select
                value={remote ? "remote" : "local"}
                onChange={(e) => setRemote(e.target.value === "remote")}
              >
                <option value="local">Same cluster{conn ? ` (${conn.name})` : ""}</option>
                <option value="remote" disabled={!otherConns.length}>
                  Another connection (remote reindex)
                </option>
              </select>
            </FormRow>
            {remote && (
              <FormRow label="Source cluster">
                <select value={sourceConnId} onChange={(e) => setSourceConnId(e.target.value)}>
                  <option value="">Pick a connection…</option>
                  {otherConns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.endpoint}</option>
                  ))}
                </select>
              </FormRow>
            )}
            <FormRow label="Source index">
              <Combobox
                id="reindex-source"
                value={sourceIndex}
                placeholder="Select index…"
                options={sourceOptions}
                onChange={setSourceIndex}
              />
            </FormRow>
            <FormRow label="Destination index">
              <input
                value={destIndex}
                placeholder="new-index-name (created if missing)"
                onChange={(e) => setDestIndex(e.target.value)}
              />
            </FormRow>
            {remote && (
              <div className="connection-note">
                <strong>Remote reindex requirements</strong>
                <span>
                  The destination cluster ({conn?.name ?? "active connection"}) pulls from the
                  source, so its elasticsearch.yml must whitelist the source host:
                  {" "}<code>reindex.remote.whitelist: "{sourceConn ? sourceConn.endpoint.replace(/^https?:\/\//, "") : "host:port"}"</code>.
                  Only basic auth is forwarded — API-key connections need credentials on the
                  source cluster.
                </span>
              </div>
            )}
            {!remote && (
              <div className="connection-note">
                <strong>How it runs</strong>
                <span>
                  POST /_reindex with wait_for_completion=false — the copy runs on the cluster
                  and survives closing this app. Mappings are NOT copied: create the destination
                  index first if it needs explicit mappings.
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="create-card">
          <h3>Progress</h3>
          <div className="create-form">
            {!taskId && (
              <pre className="create-preview">Start a reindex to track its task progress here.</pre>
            )}
            {taskId && (
              <>
                <Kv label="Task">{taskId}</Kv>
                <BarLine
                  label={task.data?.completed ? "done" : "copying"}
                  percent={percent}
                  value={total ? `${formatNumber(done)} / ${formatNumber(total)}` : "…"}
                  color={taskError ? "var(--red)" : task.data?.completed ? "var(--green)" : undefined}
                />
                <div className="seg" style={{ gap: 8, flexWrap: "wrap" }}>
                  <Badge tone={task.data?.completed ? (taskError || failures.length ? "red" : "green") : "blue"}>
                    {task.data?.completed ? (taskError || failures.length ? "finished with errors" : "completed") : "running"}
                  </Badge>
                  <Badge>batches: {formatNumber(status?.batches ?? 0)}</Badge>
                  <Badge tone={status?.version_conflicts ? "yellow" : undefined}>
                    conflicts: {formatNumber(status?.version_conflicts ?? 0)}
                  </Badge>
                  {task.data?.completed && (
                    <ToolButton onClick={reset}>
                      <Icon name="refresh" /> New reindex
                    </ToolButton>
                  )}
                </div>
                {(taskError != null || failures.length > 0) && (
                  <JsonView
                    className="create-preview json-tree"
                    value={taskError != null ? { error: taskError } : { failures }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
