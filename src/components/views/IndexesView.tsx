import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { esJson } from "../../lib/es";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { HealthPill } from "../../ui/Pills";
import { Icon } from "../../ui/Icon";
import { ContextMenu, type ContextMenuItem } from "../../ui/ContextMenu";
import { SectionVeil } from "../../ui/SectionVeil";
import { SortTh } from "../../ui/SortTh";
import { useApp } from "../../store";
import { useActiveConnection, useIndices } from "../../lib/queries";
import { formatDocCount, formatNumber } from "../../lib/format";
import { sortRows, useSort } from "../../lib/useSort";
import { pressable } from "../../ui/pressable";

export function IndexesView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const indices = useIndices();
  const queryClient = useQueryClient();
  const openTab = useApp((s) => s.openTab);
  const setActiveIndex = useApp((s) => s.setActiveIndex);
  const newQueryTab = useApp((s) => s.newQueryTab);
  const showToast = useApp((s) => s.showToast);
  const openDialog = useApp((s) => s.openDialog);
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; index: string } | null>(null);
  const { sort, cycleSort } = useSort();

  const q = filter.trim().toLowerCase();
  const filtered = (indices.data ?? []).filter(
    (i) => !q || `${i.index} ${i.aliases.join(" ")}`.toLowerCase().includes(q),
  );
  const sorted = sortRows(filtered, sort, (i, col) => {
    switch (col) {
      case "health": return i.health;
      case "index": return i.index;
      case "aliases": return i.aliases.join(", ");
      case "docs": return i.docsCount;
      case "storage": return i.storeSize;
      case "shards": return i.pri;
      case "status": return i.status;
      default: return null;
    }
  });

  /** Fire a maintenance call, toast the outcome, refresh the index list. */
  const runOp = async (label: string, method: string, path: string, body?: string) => {
    if (!conn) return;
    try {
      await esJson(conn, method, path, body);
      showToast(label, `${method} ${path} succeeded.`);
      void queryClient.invalidateQueries({ queryKey: ["indices"] });
    } catch (err) {
      showToast(`${label} failed`, String(err), "err");
    }
  };

  const menuRow = menu ? (indices.data ?? []).find((i) => i.index === menu.index) : null;

  const menuItems: ContextMenuItem[] = menu
    ? [
        {
          icon: "query", label: "Open in Query", strong: true,
          onClick: () => {
            setActiveIndex(menu.index);
            newQueryTab({ path: `/${menu.index}/_search` });
          },
        },
        {
          icon: "docs", label: "Open Documents", strong: true,
          onClick: () => {
            setActiveIndex(menu.index);
            openTab("docs");
          },
        },
        {
          icon: "mapping", label: "Open Mapping", strong: true,
          onClick: () => {
            setActiveIndex(menu.index);
            openTab("mapping");
          },
        },
        {
          icon: "activity", label: "Index stats", strong: true,
          onClick: () => {
            setActiveIndex(menu.index);
            openTab("index-stats");
          },
        },
        {
          icon: "copy", label: "Copy index name",
          onClick: () => {
            void writeText(menu.index);
            showToast("Copied", `${menu.index} copied to clipboard.`);
          },
        },
        {
          icon: "refresh", label: "Refresh index",
          onClick: () => void runOp("Index refreshed", "POST", `/${encodeURIComponent(menu.index)}/_refresh`),
        },
        {
          icon: "zap", label: "Flush index",
          onClick: () => void runOp("Index flushed", "POST", `/${encodeURIComponent(menu.index)}/_flush`),
        },
        {
          icon: "minify", label: "Force merge…",
          onClick: async () => {
            const ok = await openDialog({
              kind: "confirm",
              title: "Force merge?",
              message: `Merge "${menu.index}" down to 1 segment. I/O heavy — best on indexes that no longer receive writes.`,
              confirmLabel: "Force merge",
            });
            if (ok === null) return;
            void runOp("Force merge finished", "POST", `/${encodeURIComponent(menu.index)}/_forcemerge?max_num_segments=1`);
          },
        },
        menuRow?.status === "close"
          ? {
              icon: "play", label: "Open index",
              onClick: () => void runOp("Index opened", "POST", `/${encodeURIComponent(menu.index)}/_open`),
            }
          : {
              icon: "x", label: "Close index…",
              onClick: async () => {
                const ok = await openDialog({
                  kind: "confirm",
                  title: "Close index?",
                  message: `"${menu.index}" will reject reads and writes until reopened.`,
                  confirmLabel: "Close index",
                  danger: true,
                });
                if (ok === null) return;
                void runOp("Index closed", "POST", `/${encodeURIComponent(menu.index)}/_close`);
              },
            },
        {
          icon: "plus", label: "Add alias…",
          onClick: async () => {
            const alias = await openDialog({
              kind: "prompt",
              title: "Add alias",
              message: `New alias for "${menu.index}":`,
              confirmLabel: "Add",
            });
            if (!alias?.trim()) return;
            void runOp(
              "Alias added",
              "POST",
              "/_aliases",
              JSON.stringify({ actions: [{ add: { index: menu.index, alias: alias.trim() } }] }),
            );
          },
        },
        ...(menuRow?.aliases.length
          ? [
              {
                icon: "trash", label: "Remove alias…",
                onClick: async () => {
                  const alias = await openDialog({
                    kind: "prompt",
                    title: "Remove alias",
                    message: `Aliases on "${menu.index}": ${menuRow.aliases.join(", ")}\nAlias to remove:`,
                    defaultValue: menuRow.aliases[0],
                    confirmLabel: "Remove",
                    danger: true,
                  });
                  if (!alias?.trim()) return;
                  void runOp(
                    "Alias removed",
                    "POST",
                    "/_aliases",
                    JSON.stringify({ actions: [{ remove: { index: menu.index, alias: alias.trim() } }] }),
                  );
                },
              } satisfies ContextMenuItem,
              {
                icon: "reindex", label: "Rollover alias…",
                onClick: async () => {
                  const alias = await openDialog({
                    kind: "prompt",
                    title: "Rollover",
                    message: "Rollover creates a fresh index behind the alias and repoints writes to it.\nAlias to roll over:",
                    defaultValue: menuRow.aliases[0],
                    confirmLabel: "Rollover",
                  });
                  if (!alias?.trim()) return;
                  void runOp("Rollover done", "POST", `/${encodeURIComponent(alias.trim())}/_rollover`);
                },
              } satisfies ContextMenuItem,
            ]
          : []),
        {
          icon: "trash", label: "Delete index…",
          onClick: async () => {
            // type-the-name confirmation — deleting an index is unrecoverable
            const typed = await openDialog({
              kind: "prompt",
              title: "Delete index",
              message: `This permanently deletes "${menu.index}" and ALL its documents.\nType "${menu.index}" to confirm:`,
              confirmLabel: "Delete",
              danger: true,
            });
            if (typed !== menu.index) {
              if (typed !== null) showToast("Not deleted", "Name did not match.", "warn");
              return;
            }
            void (async () => {
              try {
                await esJson(conn!, "DELETE", `/${encodeURIComponent(menu.index)}`);
                showToast("Index deleted", `${menu.index} removed from the cluster.`);
                void queryClient.invalidateQueries({ queryKey: ["indices"] });
              } catch (err) {
                showToast("Delete failed", String(err), "err");
              }
            })();
          },
        },
      ]
    : [];

  return (
    <section className={`content indexes-view ${active ? "active" : ""}`}>
      <div className="index-searchbar">
        <input
          className="index-search"
          placeholder="Search index name, alias..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Badge>{indices.data ? `${formatNumber(filtered.length)} shown` : conn ? "loading…" : "no connection"}</Badge>
        <span style={{ color: "var(--text-3)" }}>
          Click a row to browse documents · right-click for actions.
        </span>
        <ToolButton onClick={() => openTab("mapping")}>
          <Icon name="mapping" /> Mapping
        </ToolButton>
        <ToolButton variant="primary" onClick={() => openTab("create-index")}>
          <Icon name="plus" /> Create index
        </ToolButton>
      </div>
      <div className="index-table-wrap">
        {/* isLoading = first fetch with no data yet — background refetches don't veil */}
        <SectionVeil on={indices.isLoading} label="Loading indexes…" />
        {indices.error && (
          <div className="err-note">
            {String(indices.error)}
            <ToolButton title="Reload the index list" onClick={() => void indices.refetch()}>
              <Icon name="refresh" /> Retry
            </ToolButton>
          </div>
        )}
        <table>
          <thead>
            <tr>
              <SortTh col="health" sort={sort} onSort={cycleSort}>Health</SortTh>
              <SortTh col="index" sort={sort} onSort={cycleSort}>Index name</SortTh>
              <SortTh col="aliases" sort={sort} onSort={cycleSort}>Aliases</SortTh>
              <SortTh col="docs" sort={sort} onSort={cycleSort}>Docs</SortTh>
              <SortTh col="storage" sort={sort} onSort={cycleSort}>Storage</SortTh>
              <SortTh col="shards" sort={sort} onSort={cycleSort}>Shards</SortTh>
              <SortTh col="status" sort={sort} onSort={cycleSort}>Status</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => (
              <tr
                key={i.index}
                title="Click: open Documents · right-click: more actions"
                onClick={() => {
                  setActiveIndex(i.index);
                  openTab("docs");
                }}
                {...pressable(() => {
                  setActiveIndex(i.index);
                  openTab("docs");
                })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, index: i.index });
                }}
              >
                <td><HealthPill health={i.health} /></td>
                <td><strong>{i.index}</strong></td>
                <td>{i.aliases.join(", ") || "—"}</td>
                <td>{formatDocCount(i.docsCount)}</td>
                <td>{i.storeSize}</td>
                <td>{i.pri}p / {i.rep}r</td>
                <td>{i.status}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={7} style={{ color: "var(--text-3)" }}>
                {conn ? "no indexes match" : "connect to a cluster to list indexes"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <AnimatePresence>
        {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
      </AnimatePresence>
    </section>
  );
}
