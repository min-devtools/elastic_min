import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { esJson } from "../../lib/es";
import { ToolButton } from "../../ui/ToolButton";
import { Badge } from "../../ui/Badge";
import { HealthPill } from "../../ui/Pills";
import { Icon } from "../../ui/Icon";
import { ContextMenu, type ContextMenuItem } from "../../ui/ContextMenu";
import { useApp } from "../../store";
import { useActiveConnection, useIndices } from "../../lib/queries";
import { formatDocCount } from "../../lib/format";

export function IndexesView({ active }: { active: boolean }) {
  const conn = useActiveConnection();
  const indices = useIndices();
  const queryClient = useQueryClient();
  const { openTab, setActiveIndex, newQueryTab, showToast } = useApp();
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; index: string } | null>(null);

  const q = filter.trim().toLowerCase();
  const filtered = (indices.data ?? []).filter(
    (i) => !q || `${i.index} ${i.aliases.join(" ")}`.toLowerCase().includes(q),
  );

  const menuItems: ContextMenuItem[] = menu
    ? [
        {
          icon: "⌁", label: "Open in Query", strong: true,
          onClick: () => {
            setActiveIndex(menu.index);
            newQueryTab({ path: `/${menu.index}/_search` });
          },
        },
        {
          icon: "▤", label: "Open Documents", strong: true,
          onClick: () => {
            setActiveIndex(menu.index);
            openTab("docs");
          },
        },
        {
          icon: "⌬", label: "Open Mapping", strong: true,
          onClick: () => {
            setActiveIndex(menu.index);
            openTab("mapping");
          },
        },
        {
          icon: "∿", label: "Index stats", strong: true,
          onClick: () => {
            setActiveIndex(menu.index);
            openTab("index-stats");
          },
        },
        {
          icon: "⎘", label: "Copy index name",
          onClick: () => {
            void writeText(menu.index);
            showToast("Copied", `${menu.index} copied to clipboard.`);
          },
        },
        {
          icon: "×", label: "Delete index…",
          onClick: () => {
            // type-the-name confirmation — deleting an index is unrecoverable
            const typed = window.prompt(
              `This permanently deletes the index and ALL its documents.\nType "${menu.index}" to confirm:`,
            );
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
          Click a row for actions. Filter all cluster indexes without leaving the workspace.
        </span>
        <ToolButton variant="primary" onClick={() => openTab("create-index")}>
          <Icon name="plus" /> Create index
        </ToolButton>
      </div>
      <div className="index-table-wrap">
        {indices.error && <div className="err-note">{String(indices.error)}</div>}
        <table>
          <thead>
            <tr>
              <th>Health</th><th>Index name</th><th>Aliases</th><th>Docs</th>
              <th>Storage</th><th>Shards</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr
                key={i.index}
                onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, index: i.index })}
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
