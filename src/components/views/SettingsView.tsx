import { openUrl } from "@tauri-apps/plugin-opener";
import { Icon, type IconName } from "../../ui/Icon";
import { useApp } from "../../store";
import { useSystemFonts } from "../../lib/queries";
import { THEMES, themeBase } from "../../lib/themes";

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
      <span className="settings-icon"><Icon name={icon} /></span>
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
  placeholder,
  onChange,
}: {
  value: string;
  fonts: string[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="settings-select"
      value={value}
      style={value ? { fontFamily: `"${value}"` } : undefined}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {fonts.map((f) => (
        <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>{f}</option>
      ))}
    </select>
  );
}

export function SettingsView({ active }: { active: boolean }) {
  const {
    theme, setTheme, compact, toggleCompact, vimMode, toggleVim,
    editorFontSize, setEditorFontSize, uiFontSize, setUiFontSize, uiFont, setUiFont, editorFont, setEditorFont,
    aiProvider, setAiProvider, showToast,
  } = useApp();
  const fonts = useSystemFonts();
  const fontList = fonts.data ?? [];

  return (
    <section className={`content settings-view ${active ? "active" : ""}`}>
      <div className="settings-shell">
        <div className="settings-header">
          <div className="create-kicker">Workspace settings</div>
          <h2>Appearance, fonts and editor behavior</h2>
        </div>

        <div className="settings-card">
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
            icon="rows"
            title="Compact density"
            desc="Tighter table rows and narrower side panels."
            control={
              <input type="checkbox" className="row-check" checked={compact} onChange={toggleCompact} />
            }
          />
          <Row
            icon="sun"
            title="UI font"
            desc={`Interface font, loaded from this Mac (${fontList.length || "…"} families).`}
            control={
              <FontSelect
                value={uiFont}
                fonts={fontList}
                placeholder="Inter (default)"
                onChange={(v) => {
                  setUiFont(v);
                  showToast("UI font", v ? `Switched to ${v}.` : "Reset to design default.");
                }}
              />
            }
          />
        </div>

        <div className="settings-card">
          <h3>Query editor</h3>
          <Row
            icon="keyboard"
            title="Vim mode"
            desc="Modal editing via monaco-vim. Mode shows in the editor footer."
            control={
              <input
                type="checkbox"
                className="row-check"
                checked={vimMode}
                onChange={() => {
                  toggleVim();
                  showToast("Vim mode", vimMode ? "Disabled." : "Enabled — NORMAL mode in query editor.");
                }}
              />
            }
          />
          <Row
            icon="code"
            title="Editor font"
            desc="Monospace recommended. Applies to the query editor and JSON views."
            control={
              <FontSelect
                value={editorFont}
                fonts={fontList}
                placeholder="Google Sans Code (default)"
                onChange={(v) => {
                  setEditorFont(v);
                  showToast("Editor font", v ? `Switched to ${v}.` : "Reset to design default.");
                }}
              />
            }
          />
          <Row
            icon="pencil"
            title="Editor font size"
            desc="10 – 22 px, applies to all query tabs."
            control={
              <input
                type="number"
                className="settings-select"
                style={{ width: 72 }}
                min={10}
                max={22}
                value={editorFontSize}
                onChange={(e) => setEditorFontSize(Number(e.target.value))}
              />
            }
          />
          <Row
            icon="pencil"
            title="UI font size"
            desc="10 – 20 px, whole app. ⌘+ / ⌘- to adjust (0.5 per press)."
            control={
              <input
                type="number"
                className="settings-select"
                style={{ width: 72 }}
                min={10}
                max={20}
                step={0.5}
                value={uiFontSize}
                onChange={(e) => setUiFontSize(Number(e.target.value))}
              />
            }
          />
        </div>

        <div className="settings-card">
          <h3>AI Provider (OpenAI-compatible)</h3>
          <Row
            icon="zap"
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
            icon="keyboard"
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
            icon="code"
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
        </div>

        <div className="settings-card">
          <h3>Keyboard shortcuts</h3>
          <div className="shortcut-grid">
            {[
              ["⌘↵", "Run current query"],
              ["⌘N", "New query tab"],
              ["⌘S", "Save query (sidebar + ⌘K)"],
              ["⌘W", "Close current tab (middle-click too)"],
              ["⌘1…9", "Jump to tab N (double-click a query tab to rename)"],
              ["⌘K", "Search everywhere / command palette"],
              ["⌘B", "Toggle left sidebar"],
              ["⌘R", "Toggle right inspector"],
              ["⌘D", "Open Documents"],
              ["⌘,", "Open Settings"],
              ["Esc", "Close palette / dialogs"],
            ].map(([key, desc]) => (
              <div className="shortcut-row" key={key}>
                <span className="kbd">{key}</span>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <h3>Data</h3>
          <Row
            icon="database"
            title="Connections"
            desc="Stored in Tauri app-data (elasticmin.json). Right-click a connection in the sidebar to edit or remove it."
            control={<span />}
          />
        </div>

        <div className="settings-credit">
          <button
            type="button"
            className="settings-github"
            onClick={() => openUrl("https://github.com/ngthminhdev/elastic_min")}
          >
            <Icon name="github" /> View on GitHub
          </button>
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
