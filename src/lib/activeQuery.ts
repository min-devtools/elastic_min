type TabRef = { id: string; kind: string } | undefined;

export function activeSubmitTarget(tab: TabRef): "query" | "docs" | null {
  return tab?.kind === "query" || tab?.kind === "docs" ? tab.kind : null;
}

export function activeQueryTabId(tab: TabRef): string | null {
  return tab?.kind === "query" ? tab.id : null;
}
