# AI Chat Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and restore the 10 most recent AI conversations while simplifying the right inspector to JSON, Metadata, and AI.

**Architecture:** Put serializable chat-session state and mutations in the existing Zustand store, backed by a dedicated `localStorage` entry through the existing persistence subscriber. Make `AiChat` render and update the active store session, and remove the Actions pane from `Inspector`.

**Tech Stack:** React 18, TypeScript, Zustand 5, browser `localStorage`, Vite 5

## Global Constraints

- Keep at most 10 global AI chat sessions, ordered by most recent update.
- Use the first user question, truncated to about 40 characters, as the title.
- Keep provider context limited to the latest eight entries.
- Do not add dependencies or backend storage.
- Preserve responses in the session that initiated each request.

---

### Task 1: Store-backed chat sessions

**Files:**
- Modify: `src/store.ts`
- Modify: `src/lib/persist.ts`

**Interfaces:**
- Produces: exported `AiChatEntry`, `AiChatSession`, store fields `aiSessions`, `activeAiSessionId`, and actions `newAiSession`, `setActiveAiSession`, `appendAiEntry`, `deleteAiSession`.
- Consumes: browser `localStorage`, Zustand `set` and `get`.

- [ ] **Step 1: Add serializable chat types and validated loading**

Define entries with `role`, `text`, optional generated query, and optional error flag. Define sessions with `id`, `title`, `createdAt`, `updatedAt`, and `entries`. Load the dedicated storage key, reject malformed sessions, sort by `updatedAt`, cap at 10, and create a fresh empty session when none survive.

- [ ] **Step 2: Add minimal state actions**

Implement session creation, selection, append, and deletion. `appendAiEntry` must target an explicit session ID, derive the title from its first user message, move the session to the front, and cap the result at 10. Deleting the final session creates and activates a replacement.

- [ ] **Step 3: Persist reference changes**

Extend `initPersistence`'s Zustand subscription to write `{ sessions, activeSessionId }` to the dedicated key whenever either reference changes. Wrap `localStorage.setItem` in `try/catch` so quota or storage failures do not break the app.

- [ ] **Step 4: Verify type safety**

Run: `npm run build`

Expected: TypeScript and Vite production build complete successfully.

### Task 2: Session-aware AI UI

**Files:**
- Modify: `src/components/AiChat.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: Task 1's session state/actions and existing `askAi`, `parseGeneratedQuery`, `applyGeneratedQuery`.
- Produces: compact session switcher with create and delete controls.

- [ ] **Step 1: Replace component-local entries**

Select the active session from the store. Keep only input and request busy state local. On send, capture the active session ID, append the user entry immediately, construct provider messages from that session's resulting last eight entries, and append the response/error to the captured ID.

- [ ] **Step 2: Add compact session controls**

Render a native `<select>` ordered by session recency, an icon-only plus button, and an icon-only delete button above the message list. Use existing `ToolButton` and `Icon` components. Show the existing empty hint only when the active session has no entries.

- [ ] **Step 3: Style within current design tokens**

Add one compact flex row and select styles. Reuse existing border, surface, text, and accent variables. Do not alter the overall inspector width or introduce a nested sidebar.

- [ ] **Step 4: Verify type safety**

Run: `npm run build`

Expected: TypeScript and Vite production build complete successfully.

### Task 3: Remove Actions from the right dock

**Files:**
- Modify: `src/components/Inspector.tsx`

**Interfaces:**
- Consumes: existing JSON and Metadata panes.
- Produces: inspector tab list containing only `json`, `meta`, and `ai`.

- [ ] **Step 1: Remove Actions tab and dead code**

Delete the Actions tab, its rendered pane, clipboard import, copy helper, and document delete helper. Remove any hook values used only by that pane while preserving JSON save and metadata behavior.

- [ ] **Step 2: Verify production build**

Run: `npm run build`

Expected: TypeScript and Vite production build complete successfully with no unused imports or missing symbols.

### Task 4: Final behavioral review

**Files:**
- Review: `src/store.ts`
- Review: `src/lib/persist.ts`
- Review: `src/components/AiChat.tsx`
- Review: `src/components/Inspector.tsx`
- Review: `src/styles/components.css`

**Interfaces:**
- Consumes: completed feature.
- Produces: verified production build and focused diff.

- [ ] **Step 1: Inspect the diff**

Run: `git diff -- src/store.ts src/lib/persist.ts src/components/AiChat.tsx src/components/Inspector.tsx src/styles/components.css`

Expected: only session persistence, AI switcher, and Actions removal are present.

- [ ] **Step 2: Run final build**

Run: `npm run build`

Expected: command exits 0.

- [ ] **Step 3: Check affected flows**

Confirm explicit-session response routing, final-session replacement, recency sorting, 10-session cap, title truncation, malformed-storage fallback, and no remaining Actions tab markup.
