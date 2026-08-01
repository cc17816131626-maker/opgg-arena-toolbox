use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {e}"))?
        .join("data");
    std::fs::create_dir_all(&dir).map_err(|e| format!("无法创建数据目录: {e}"))?;
    Ok(dir)
}

pub fn local_manifest_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("manifest.json"))
}

pub fn local_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("arena-data.json"))
}

pub fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法获取应用配置目录: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("无法创建配置目录: {e}"))?;
    Ok(dir.join("settings.json"))
}
