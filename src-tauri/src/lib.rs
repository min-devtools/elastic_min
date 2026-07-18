use std::sync::OnceLock;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

/// Cached clients (one per TLS mode) — keep-alive instead of a new pool + TLS
/// handshake per request (3 polling queries fire every 10s).
fn es_client(insecure: bool) -> Result<&'static reqwest::Client, String> {
    static VERIFIED: OnceLock<reqwest::Client> = OnceLock::new();
    static INSECURE: OnceLock<reqwest::Client> = OnceLock::new();
    let cell = if insecure { &INSECURE } else { &VERIFIED };
    if let Some(c) = cell.get() {
        return Ok(c);
    }
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(insecure)
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    Ok(cell.get_or_init(|| client))
}

fn ai_client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    if let Some(c) = CLIENT.get() {
        return Ok(c);
    }
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;
    Ok(CLIENT.get_or_init(|| client))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EsConnection {
    pub endpoint: String,
    /// "apiKey" | "basic" | "none"
    pub auth_type: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    /// accept self-signed certificates (local clusters)
    #[serde(default)]
    pub insecure: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EsResponse {
    pub status: u16,
    pub time_ms: u64,
    /// raw response body (usually JSON text)
    pub body: String,
}

#[tauri::command]
async fn es_request(
    conn: EsConnection,
    method: String,
    path: String,
    body: Option<String>,
    content_type: Option<String>,
) -> Result<EsResponse, String> {
    let client = es_client(conn.insecure)?;

    let method = reqwest::Method::from_bytes(method.to_uppercase().as_bytes())
        .map_err(|_| format!("invalid HTTP method: {method}"))?;
    let url = format!(
        "{}/{}",
        conn.endpoint.trim_end_matches('/'),
        path.trim_start_matches('/')
    );

    let mut req = client.request(method, &url);
    match conn.auth_type.as_str() {
        "apiKey" => {
            if let Some(key) = conn.api_key.filter(|k| !k.is_empty()) {
                req = req.header("Authorization", format!("ApiKey {key}"));
            }
        }
        "basic" => {
            req = req.basic_auth(
                conn.username.unwrap_or_default(),
                conn.password.filter(|p| !p.is_empty()),
            );
        }
        _ => {}
    }
    if let Some(body) = body.filter(|b| !b.trim().is_empty()) {
        let ct = content_type.unwrap_or_else(|| "application/json".into());
        req = req.header("Content-Type", ct).body(body);
    }

    let started = Instant::now();
    let res = req.send().await.map_err(|e| {
        // strip reqwest noise down to something the UI can show
        let mut msg = e.to_string();
        if let Some(src) = std::error::Error::source(&e) {
            msg = format!("{msg}: {src}");
        }
        msg
    })?;
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| e.to_string())?;

    Ok(EsResponse {
        status,
        time_ms: started.elapsed().as_millis() as u64,
        body,
    })
}

/// Proxy one chat completion to an OpenAI-compatible endpoint (avoids webview CORS).
#[tauri::command]
async fn ai_chat(
    endpoint: String,
    api_key: String,
    model: String,
    messages: serde_json::Value,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", endpoint.trim_end_matches('/'));
    let client = ai_client()?;
    let mut req = client.post(&url);
    // keyless local providers (ollama, llama.cpp) reject a bare "Bearer " header
    if !api_key.is_empty() {
        req = req.bearer_auth(api_key);
    }
    let res = req
        .json(&serde_json::json!({ "model": model, "messages": messages }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        // surface the provider's error message if present
        let msg = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v["error"]["message"].as_str().map(String::from))
            .unwrap_or_else(|| text.chars().take(300).collect());
        return Err(format!("HTTP {status}: {msg}"));
    }
    let v: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    v["choices"][0]["message"]["content"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| "provider returned no message content".into())
}

/// List installed font family names (macOS: NSFontManager via JXA — no extra crates).
#[tauri::command]
async fn list_fonts() -> Result<Vec<String>, String> {
    let out = std::process::Command::new("osascript")
        .args([
            "-l",
            "JavaScript",
            "-e",
            r#"ObjC.import("AppKit"); JSON.stringify(ObjC.deepUnwrap($.NSFontManager.sharedFontManager.availableFontFamilies))"#,
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).into_owned());
    }
    let json = String::from_utf8_lossy(&out.stdout);
    let mut fonts: Vec<String> =
        serde_json::from_str(json.trim()).map_err(|e| e.to_string())?;
    fonts.retain(|f| !f.starts_with('.')); // hidden system families
    fonts.sort();
    Ok(fonts)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
.plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![es_request, list_fonts, ai_chat])
        .setup(|app| {
            // Custom menu without File > Close Window so ⌘W reaches the webview
            // (used to close the active workspace tab). Edit menu kept for copy/paste.
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{Menu, PredefinedMenuItem, Submenu};
                let handle = app.handle();
                let app_menu = Submenu::with_items(
                    handle,
                    "ElasticMin",
                    true,
                    &[
                        &PredefinedMenuItem::about(handle, None, None)?,
                        &PredefinedMenuItem::separator(handle)?,
                        &PredefinedMenuItem::hide(handle, None)?,
                        &PredefinedMenuItem::hide_others(handle, None)?,
                        &PredefinedMenuItem::show_all(handle, None)?,
                        &PredefinedMenuItem::separator(handle)?,
                        &PredefinedMenuItem::quit(handle, None)?,
                    ],
                )?;
                let edit = Submenu::with_items(
                    handle,
                    "Edit",
                    true,
                    &[
                        &PredefinedMenuItem::undo(handle, None)?,
                        &PredefinedMenuItem::redo(handle, None)?,
                        &PredefinedMenuItem::separator(handle)?,
                        &PredefinedMenuItem::cut(handle, None)?,
                        &PredefinedMenuItem::copy(handle, None)?,
                        &PredefinedMenuItem::paste(handle, None)?,
                        &PredefinedMenuItem::select_all(handle, None)?,
                    ],
                )?;
                let window = Submenu::with_items(
                    handle,
                    "Window",
                    true,
                    &[
                        &PredefinedMenuItem::minimize(handle, None)?,
                        &PredefinedMenuItem::maximize(handle, None)?,
                        &PredefinedMenuItem::fullscreen(handle, None)?,
                    ],
                )?;
                let menu = Menu::with_items(handle, &[&app_menu, &edit, &window])?;
                app.set_menu(menu)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
