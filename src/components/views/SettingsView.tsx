import { openUrl } from "@tauri-apps/plugin-opener";
import { Icon, type IconName } from "../../ui/Icon";
import { ToolButton } from "../../ui/ToolButton";
import { useApp } from "../../store";
import { useSystemFonts } from "../../lib/queries";
import { THEMES, themeBase } from "../../lib/themes";
import { FONT_SIZE_STEP } from "../../lib/fontScale";

function Row({
  icon,
  title,
  desc,
  control,
}: {
  icon: IconName;
  title: string;
  desc: string;
  control: JSX.Element;
}) {
  return (
    <div className="settings-row">
      <span className="settings-icon"><Icon name={icon} size={15} /></span>
      <div className="settings-copy">
        <strong>{title}</strong>
        <span>{desc}</span>
      </div>
      <div className="settings-control">{control}</div>
    </div>
  );
}

function FontSelect({
  value,
  fonts,
  onChange,
}: {
  value: string;
  fonts: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="settings-select"
      value={value}
      style={value ? { fontFamily: `"${value}"` } : undefined}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Design default</option>
      {fonts.map((f) => (
        <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>{f}</option>
      ))}
    </select>
  );
}

export function SettingsView({ active }: { active: boolean }) {
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const compact = useApp((s) => s.compact);
  const toggleCompact = useApp((s) => s.toggleCompact);
  const vimMode = useApp((s) => s.vimMode);
  const toggleVim = useApp((s) => s.toggleVim);
  const editorFontSize = useApp((s) => s.editorFontSize);
  const setEditorFontSize = useApp((s) => s.setEditorFontSize);
  const uiFontSize = useApp((s) => s.uiFontSize);
  const setUiFontSize = useApp((s) => s.setUiFontSize);
  const uiFont = useApp((s) => s.uiFont);
  const setUiFont = useApp((s) => s.setUiFont);
  const editorFont = useApp((s) => s.editorFont);
  const setEditorFont = useApp((s) => s.setEditorFont);
  const aiProvider = useApp((s) => s.aiProvider);
  const setAiProvider = useApp((s) => s.setAiProvider);
  const showToast = useApp((s) => s.showToast);
  const fonts = useSystemFonts();
  const fontList = fonts.data ?? [];

  return (
    <section className={`content settings-view ${active ? "active" : ""}`}>
      <div className="settings-shell">
        <div className="settings-header">
          <h2>Settings</h2>
          <p style={{ margin: 0, color: "var(--text-3)", fontSize: "0.9231rem" }}>Appearance, fonts, editor behavior, and keyboard shortcuts for this workspace.</p>
        </div>

        <section className="settings-card">
          <h3>Appearance</h3>
          <Row
            icon={themeBase(theme) === "dark" ? "moon" : "sun"}
            title="Theme"
            desc={`${THEMES.length} themes — palettes ported from the Netherize theme collection.`}
            control={
              <select
                className="settings-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <optgroup label="Dark">
                  {THEMES.filter((t) => t.base === "dark").map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Light">
                  {THEMES.filter((t) => t.base === "light").map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </optgroup>
              </select>
            }
          />
          <Row
            icon="braces"
            title="Interface font size"
            desc={`Scales all interface text in 0.5px steps. Current: ${uiFontSize}px. ⌘+ / ⌘− to adjust.`}
            control={
              <div style={{ display: "flex", gap: 6 }}>
                <ToolButton iconOnly title="Decrease interface font (⌘−)" onClick={() => setUiFontSize(uiFontSize - FONT_SIZE_STEP)}>−</ToolButton>
                <ToolButton title="Reset to default" onClick={() => setUiFontSize(0)}>{uiFontSize}px</ToolButton>
                <ToolButton iconOnly title="Increase interface font (⌘+)" onClick={() => setUiFontSize(uiFontSize + FONT_SIZE_STEP)}>+</ToolButton>
              </div>
            }
          />
          <Row
            icon="rows"
            title="Interface font family"
            desc={`Applied across the workspace, loaded from this Mac (${fontList.length || "…"} families).`}
            control={<FontSelect value={uiFont} fonts={fontList} onChange={setUiFont} />}
          />
          <Row
            icon="braces"
            title="Editor font family"
            desc="Monospace recommended. Applies to the query editor and JSON views."
            control={<FontSelect value={editorFont} fonts={fontList} onChange={setEditorFont} />}
          />
          <Row
            icon="pencil"
            title="Editor font size"
            desc={`10 – 22 px, applies to all query tabs. Current: ${editorFontSize}px.`}
            control={
              <div style={{ display: "flex", gap: 6 }}>
                <ToolButton iconOnly title="Decrease editor font" onClick={() => setEditorFontSize(editorFontSize - 1)}>−</ToolButton>
                <ToolButton title="Reset to default" onClick={() => setEditorFontSize(0)}>{editorFontSize}px</ToolButton>
                <ToolButton iconOnly title="Increase editor font" onClick={() => setEditorFontSize(editorFontSize + 1)}>+</ToolButton>
              </div>
            }
          />
          <Row
            icon="rows"
            title="Compact density"
            desc="Tighter table rows and narrower side panels."
            control={
              <label className="switch"><input type="checkbox" checked={compact} onChange={toggleCompact} /><span /></label>
            }
          />
          <Row
            icon="keyboard"
            title="Vim mode"
            desc="Modal editing via monaco-vim in the query editor. Mode shows in the editor footer."
            control={
              <label className="switch">
                <input
                  type="checkbox"
                  checked={vimMode}
                  onChange={() => {
                    toggleVim();
                    showToast("Vim mode", vimMode ? "Disabled." : "Enabled — NORMAL mode in query editor.");
                  }}
                />
                <span />
              </label>
            }
          />
        </section>

        <section className="settings-card">
          <h3>AI Provider (OpenAI-compatible)</h3>
          <Row
            icon="globe"
            title="Endpoint"
            desc="Base URL of the API, e.g. https://api.openai.com/v1 — requests go to {endpoint}/chat/completions."
            control={
              <input
                className="settings-select"
                style={{ width: 220 }}
                placeholder="https://api.openai.com/v1"
                value={aiProvider.endpoint}
                onChange={(e) => setAiProvider({ endpoint: e.target.value.trim() })}
              />
            }
          />
          <Row
            icon="key"
            title="API key"
            desc="Sent as Bearer token. Stored locally on this Mac."
            control={
              <input
                className="settings-select"
                style={{ width: 220 }}
                type="password"
                placeholder="sk-…"
                value={aiProvider.apiKey}
                onChange={(e) => setAiProvider({ apiKey: e.target.value.trim() })}
              />
            }
          />
          <Row
            icon="braces"
            title="Model"
            desc="Any chat model the endpoint serves, e.g. gpt-4o-mini, claude-sonnet-5, llama3."
            control={
              <input
                className="settings-select"
                style={{ width: 220 }}
                placeholder="gpt-4o-mini"
                value={aiProvider.model}
                onChange={(e) => setAiProvider({ model: e.target.value.trim() })}
              />
            }
          />
          <Row
            icon="database"
            title="Usage"
            desc="Open the AI tab in the right dock (next to JSON / Metadata) and describe the query — it lands in the open Query tab."
            control={<span />}
          />
        </section>

        <section className="settings-card">
          <h3>Shortcuts</h3>
          <div className="shortcut-grid">
            {[
              ["Run current query", "⌘↵"],
              ["New query tab", "⌘N"],
              ["Save query (sidebar + ⌘K)", "⌘S"],
              ["Close current tab (middle-click too)", "⌘W"],
              ["Jump to tab 1…9", "⌘1…9"],
              ["Search everywhere / command palette", "⌘K"],
              ["Toggle left sidebar", "⌘B"],
              ["Toggle right inspector", "⌘R"],
              ["Open Documents", "⌘⇧D"],
              ["Increase font", "⌘+"],
              ["Decrease font", "⌘−"],
              ["Open Settings", "⌘,"],
              ["Rename / edit selected connection", "⌘E"],
              ["Duplicate selected connection", "⌘D"],
              ["Delete selected connection", "⌘⌫"],
            ].map(([desc, key]) => (
              <div className="shortcut-row" key={key}>
                <span>{desc}</span>
                <span className="kbd">{key}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <h3>Data</h3>
          <Row
            icon="database"
            title="Connections"
            desc="Stored in Tauri app-data (elasticmin.json). Right-click a connection in the sidebar to edit or remove it."
            control={<span />}
          />
        </section>

        <div className="settings-credit">
          <button
            type="button"
            className="settings-github"
            onClick={() => openUrl("https://github.com/min-devtools/elastic_min")}
          >
            <Icon name="github" /> View on GitHub
          </button>
          <strong>ElasticMin</strong>
          <button
            type="button"
            className="settings-credit-link"
            onClick={() => openUrl("https://www.linkedin.com/in/ngthminh-dev/")}
          >
            Created by @ngthminhdev
          </button>
        </div>
      </div>
    </section>
  );
}
