use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::AppHandle;

use crate::paths::settings_path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum UpdateFrequency {
    OnLaunch,
    Every6Hours,
    Daily,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub auto_update: bool,
    pub update_frequency: UpdateFrequency,
    pub last_checked_at: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_update: true,
            update_frequency: UpdateFrequency::OnLaunch,
            last_checked_at: None,
        }
    }
}

pub(crate) fn load_settings_from_path(path: &Path) -> Result<AppSettings, String> {
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = std::fs::read_to_string(path).map_err(|e| format!("读取设置失败: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("解析设置失败: {e}"))
}

pub(crate) fn save_settings_to_path(path: &Path, settings: &AppSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败: {e}"))?;
    }
    let content = serde_json::to_string_pretty(settings).map_err(|e| format!("序列化设置失败: {e}"))?;
    std::fs::write(path, content).map_err(|e| format!("写入设置失败: {e}"))
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(&app)?;
    load_settings_from_path(&path)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    eprintln!(
        "[settings] 保存设置 autoUpdate={} frequency={:?}",
        settings.auto_update, settings.update_frequency
    );
    save_settings_to_path(&path, &settings)
}

pub fn touch_last_checked(app: &AppHandle) -> Result<(), String> {
    let mut settings = get_settings(app.clone())?;
    settings.last_checked_at = Some(chrono::Utc::now().to_rfc3339());
    save_settings(app.clone(), settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_settings_path() -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("arena-settings-test-{nanos}.json"))
    }

    #[test]
    fn missing_file_returns_defaults() {
        let path = temp_settings_path();
        let _ = fs::remove_file(&path);
        let settings = load_settings_from_path(&path).unwrap();
        assert_eq!(settings, AppSettings::default());
    }

    #[test]
    fn roundtrip_preserves_fields() {
        let path = temp_settings_path();
        let original = AppSettings {
            auto_update: false,
            update_frequency: UpdateFrequency::Every6Hours,
            last_checked_at: Some("2026-08-01T00:00:00Z".into()),
        };
        save_settings_to_path(&path, &original).unwrap();
        let loaded = load_settings_from_path(&path).unwrap();
        assert_eq!(loaded, original);
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn rejects_corrupt_json() {
        let path = temp_settings_path();
        fs::write(&path, "{not json").unwrap();
        let err = load_settings_from_path(&path).unwrap_err();
        assert!(err.contains("解析设置失败"));
        let _ = fs::remove_file(&path);
    }
}
