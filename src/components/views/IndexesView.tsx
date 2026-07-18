import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { esJson } from "../../lib/es";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { HealthPill } from "../../ui/Pills";
import { Icon } from "../../ui/Icon";
import { ContextMenu, type ContextMenuItem } from "../../ui/ContextMenu";
import { SortTh } from "../../ui/SortTh";
import { useApp } from "../../store";
import { useActiveConnection, useIndices } from "../../lib/queries";
import { formatDocCount } from "../../lib/format";
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
        <Badge>{indices.data ? `${filtered.length} shown` : conn ? "loading…" : "no connection"}</Badge>
        <span style={{ color: "var(--text-3)" }}>
          Click a row to browse documents · right-click for actions.
        </span>
        <ToolButton variant="primary" onClick={() => openTab("create-index")}>
          <Icon name="plus" /> Create index
        </ToolButton>
      </div>
      <div className="index-table-wrap">
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
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}
    </section>
  );
}
