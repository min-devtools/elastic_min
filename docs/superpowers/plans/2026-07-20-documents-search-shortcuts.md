# Documents Search Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Documents index selection stable and route Enter/Cmd+Enter to fresh server-side Documents searches while preserving Query execution from focused inputs.

**Architecture:** Keep Documents draft/applied filter state local. Use one native form submission path and route the app shortcut by active tab kind. Extract only pure decision helpers needed for low-cost Node tests.

**Tech Stack:** React 18, TypeScript, Zustand, TanStack React Query, Node test runner, Elasticsearch `_search`.

## Global Constraints

- No request while typing.
- One Elasticsearch request per explicit submit.
- Server-side pagination stays at 50 records per page.
- No new dependency or global Documents filter state.

---

### Task 1: Stable Combobox Enter

**Files:**
- Modify: `src/ui/Combobox.tsx`
- Create: `src/ui/comboboxSelection.ts`
- Test: `src/ui/comboboxSelection.test.mjs`

**Interfaces:**
- Produces: `comboboxEnterValue(value, highlighted, interacted): string`.

- [ ] Write tests proving untouched Enter keeps `value`, while typed or arrow-interacted Enter returns `highlighted`.
- [ ] Run `node --experimental-strip-types --test src/ui/comboboxSelection.test.mjs`; expect the new assertions to fail.
- [ ] Implement `comboboxEnterValue` and track keyboard interaction per open session in `Combobox`.
- [ ] Run the focused test; expect all assertions to pass.

### Task 2: Contextual Submit Routing

**Files:**
- Modify: `src/lib/activeQuery.ts`
- Modify: `src/lib/activeQuery.test.mjs`
- Modify: `src/lib/runQuery.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `activeSubmitTarget(tab): "query" | "docs" | null`.
- Consumes: active tab kind and active Documents form id `docs-search-${tab.id}`.

- [ ] Add tests proving Query, Documents, and unrelated tab routing.
- [ ] Run `node --experimental-strip-types --test src/lib/activeQuery.test.mjs`; expect Documents routing to fail.
- [ ] Route Cmd/Ctrl+Enter to `runActiveQuery()` for Query and `requestSubmit()` for the active Documents form.
- [ ] Keep Monaco's existing `defaultPrevented` guard to avoid duplicate Query requests.
- [ ] Run the focused test; expect all assertions to pass.

### Task 3: Documents Native Search Submission

**Files:**
- Modify: `src/components/views/DocsView.tsx`
- Create: `src/lib/documentSearch.ts`
- Test: `src/lib/documentSearch.test.mjs`

**Interfaces:**
- Produces: `nextDocumentSearch(currentApplied, draft, page): { applied: string; page: number; refetch: boolean }`.

- [ ] Add tests proving submission resets page and same-filter submission requests a refetch.
- [ ] Run `node --experimental-strip-types --test src/lib/documentSearch.test.mjs`; expect failure before implementation.
- [ ] Wrap search controls in `<form id={`docs-search-${tabId}`}>`; use `onSubmit` for plain Enter, Cmd/Ctrl+Enter, and button click.
- [ ] On changed filter, update `applied` and page zero; on unchanged filter at page zero, call `search.refetch()` exactly once.
- [ ] Keep query key fields `index`, `applied`, `page`, and `sort`; keep request body `size: 50`, `from`, `query_string`, and `track_total_hits: true`.
- [ ] Run focused tests, `npm test`, and `npm run build`; expect zero failures and exit code 0.
