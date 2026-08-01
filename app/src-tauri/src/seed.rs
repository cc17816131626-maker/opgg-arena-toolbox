use std::path::PathBuf;

use sha2::{Digest, Sha256};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

use crate::paths::{local_data_path, local_manifest_path};
use crate::update::Manifest;

/// 首次启动、本地还没有任何数据（全新安装、还没联网下载过）时，
/// 用安装包里自带的一份种子数据把本地数据目录填上，这样应用开箱即用，
/// 不用非得先联网成功一次才能看到内容。
///
/// 之后不管是「检查更新」还是「下载数据」，走的都是远程 manifest，
/// 拿到更新后会原子替换掉这份种子数据，所以这里不会跟真正的更新机制打架。
pub fn ensure_seed_data(app: &AppHandle) {
    if let Err(err) = try_ensure_seed_data(app, false) {
        eprintln!("[seed] 写入内置种子数据失败（不影响后续手动下载）: {err}");
    }
}

/// 设置页「下载数据」在远程更新不可用时的回退：强制用内置种子数据覆盖本地。
#[tauri::command]
pub fn import_bundled_data(app: AppHandle) -> Result<Manifest, String> {
    try_ensure_seed_data(&app, true)
}

fn try_ensure_seed_data(app: &AppHandle, force: bool) -> Result<Manifest, String> {
    let data_path = local_data_path(app)?;
    if !force && data_path.exists() {
        return read_local_or_err(app);
    }

    let resource_path = resolve_seed_path(app)?;
    let bytes = std::fs::read(&resource_path).map_err(|e| format!("读取内置种子数据失败: {e}"))?;
    let manifest = build_manifest_from_seed_bytes(&bytes)?;

    std::fs::write(&data_path, &bytes).map_err(|e| format!("写入本地数据失败: {e}"))?;
    std::fs::write(
        local_manifest_path(app)?,
        serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("写入本地 manifest 失败: {e}"))?;

    eprintln!(
        "[seed] 已{}内置数据 version={} patch={}",
        if force { "强制导入" } else { "写入" },
        manifest.version,
        manifest.patch
    );

    Ok(manifest)
}

pub(crate) fn build_manifest_from_seed_bytes(bytes: &[u8]) -> Result<Manifest, String> {
    let json: serde_json::Value =
        serde_json::from_slice(bytes).map_err(|e| format!("解析内置种子数据失败: {e}"))?;
    let patch = json.get("patch").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
    let generated_at = json.get("generatedAt").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let sha256 = format!("{:x}", hasher.finalize());

    Ok(Manifest {
        version: format!("bundled-{patch}"),
        patch,
        generated_at,
        data_url: String::new(),
        sha256,
        size_bytes: bytes.len() as u64,
    })
}

/// tauri.conf.json 里写的是 `resources/seed-data.json`，开发模式会被拷到
/// `target/debug/resources/seed-data.json`；resolve 时必须用同样的相对路径，
/// 不能只写 `seed-data.json`（那会去 exe 同级目录找，必然 404）。
fn resolve_seed_path(app: &AppHandle) -> Result<PathBuf, String> {
    let candidates = [
        "resources/seed-data.json", // 与 tauri.conf.json > bundle.resources 一致
        "seed-data.json",           // 兜底：某些打包形态可能扁平化
    ];

    let mut tried = Vec::new();
    for relative in candidates {
        if let Ok(path) = app.path().resolve(relative, BaseDirectory::Resource) {
            if path.exists() {
                return Ok(path);
            }
            tried.push(path.display().to_string());
        }
    }

    // 开发时再兜一层：直接读源码树里的 resources/，避免资源还没同步到 target 时翻车
    let source_fallback = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/seed-data.json");
    if source_fallback.exists() {
        return Ok(source_fallback);
    }
    tried.push(source_fallback.display().to_string());

    Err(format!(
        "安装包里没有找到内置数据文件。已尝试：{}。请重新启动桌面客户端，或配置好远程更新地址后再试。",
        tried.join(" · ")
    ))
}

fn read_local_or_err(app: &AppHandle) -> Result<Manifest, String> {
    let path = local_manifest_path(app)?;
    let content = std::fs::read_to_string(&path).map_err(|e| format!("读取本地 manifest 失败: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("解析本地 manifest 失败: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_manifest_from_valid_seed_json() {
        let bytes = br#"{"schemaVersion":1,"patch":"16.15.1","generatedAt":"2026-08-01T00:00:00Z","champions":[],"championDetails":{}}"#;
        let manifest = build_manifest_from_seed_bytes(bytes).unwrap();
        assert_eq!(manifest.version, "bundled-16.15.1");
        assert_eq!(manifest.patch, "16.15.1");
        assert_eq!(manifest.generated_at, "2026-08-01T00:00:00Z");
        assert_eq!(manifest.size_bytes, bytes.len() as u64);
        assert_eq!(manifest.sha256.len(), 64);
        assert!(manifest.data_url.is_empty());
    }

    #[test]
    fn build_manifest_rejects_invalid_json() {
        let err = build_manifest_from_seed_bytes(b"not-json").unwrap_err();
        assert!(err.contains("解析内置种子数据失败"));
    }
}
