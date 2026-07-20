# Documents Search Shortcuts Design

## Scope

Fix two Documents tab interactions:

- Pressing Enter in the index combobox without editing must keep the current index.
- Enter and Cmd/Ctrl+Enter in Documents search must submit a fresh Elasticsearch search.

## Behavior

The index combobox opens with the current option selected. Enter without typing or moving the keyboard cursor closes the list without changing the value. Typing filters the options; arrow navigation and Enter continue to select the highlighted option.

Documents search keeps draft text local and makes no request while typing. Enter, Cmd/Ctrl+Enter, and the filter button share one submit action. Submission applies the draft filter, resets pagination to page zero, and refetches even when the submitted text is unchanged.

Cmd/Ctrl+Enter remains contextual: it runs a Query only when a Query tab is active and submits Documents search only when a Documents tab is active. It does nothing on unrelated tabs.

The Query path input must not swallow Cmd/Ctrl+Enter. When focus is in that input, the shortcut runs the active Query exactly once, matching Monaco editor behavior.

## Data Flow And Performance

Each Documents submission sends one Elasticsearch `POST /{index}/_search` request using `query_string`, `size: 50`, `from: page * 50`, and `track_total_hits: true`. Filtering is server-side across the index, never client-side over the current 50 rows.

Changing page or sort issues one request with the applied filter. React Query retains the previous page while fetching. No debounce, per-keystroke request, additional dependency, global filter state, or custom event protocol is introduced.

## Implementation

Use a native form for the Documents search controls. Plain Enter uses form submission. The app-level shortcut locates the active Documents search form and calls `requestSubmit()`, preserving one submission path.

Track whether the combobox user typed or moved the keyboard cursor during the current open session. On untouched Enter, keep the existing value. On interaction, select the highlighted option.

## Tests

- Combobox selection logic preserves the current value on untouched Enter.
- Typed or keyboard-navigated Enter selects the highlighted option.
- Documents submission distinguishes a changed filter, same-filter refetch, and page reset.
- Active-tab shortcut routing targets Query and Documents only.
- Cmd/Ctrl+Enter from the Query path input runs the active Query once.
- Full test suite and production build pass.
