# AI Chat Sessions and Right Dock Design

## Goal

Keep AI conversations when users switch inspector or workspace tabs and restore the 10 most recent conversations after an app restart. Simplify the right dock by removing the low-value Actions pane.

## User Experience

- The inspector exposes JSON, Metadata, and AI panes. Actions is removed.
- AI shows a compact session switcher above the message list, preserving the dock width for conversation content.
- A plus button creates and activates an empty conversation.
- A delete control removes the active conversation.
- The first user message becomes the session title, truncated to about 40 characters.
- Sessions are global across Elasticsearch connections and sorted by most recent activity.
- Only the 10 most recently updated sessions are retained. Creating or updating another session removes the oldest one.
- Switching tabs or restarting the app restores the active session and its messages.

## State and Persistence

Add AI session state to the existing Zustand app store. Each session contains an ID, title, timestamps, and serializable chat entries. The store owns create, select, update, and delete operations so the data survives `AiChat` unmounts.

Persist sessions and the active session ID to a dedicated `localStorage` key through the existing persistence subscription. Loading validates the stored shape and falls back to one empty session when data is missing or invalid. No provider credentials or system prompts are copied into chat history.

## Chat Flow

On send, append the user entry immediately and update session recency. Build the provider request from the updated active session, retaining the current limit of eight recent entries. Append either the parsed assistant result, plain assistant text, or an error entry when the request finishes.

Changing sessions while a request is in flight must not redirect its response: the response is appended to the session that initiated the request. Busy state remains component-local and prevents concurrent sends from the mounted chat view.

## Right Dock Cleanup

Remove the Actions tab and its copy/delete handlers from `Inspector`. Document editing and save behavior remain in JSON; Metadata remains read-only. This intentionally removes the inspector shortcuts for copying document ID/JSON and deleting a document.

## Error Handling

- Invalid persisted data yields a fresh empty session.
- Deleting the final session immediately creates a new empty session.
- Storage write failures must not interrupt chat behavior.
- AI request failures remain visible as persisted error messages.

## Verification

- TypeScript and production build pass.
- A session survives switching inspector and workspace tabs.
- A session survives app reload.
- New, switch, and delete controls target the correct session.
- The first question supplies a truncated title.
- Updating an older session moves it to the front.
- Only 10 sessions remain after creating an eleventh.
- A response returns to its originating session after the active session changes.
- Inspector contains no Actions tab.
