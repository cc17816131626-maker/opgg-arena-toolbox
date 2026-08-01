use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

/// 图片本地缓存目录：appdata/images。里面按 URL 内容哈希命名，
/// 同一张图（哪怕来自不同英雄/装备但是同一个文件）只会存一份。
fn image_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {e}"))?
        .join("images");
    std::fs::create_dir_all(&dir).map_err(|e| format!("无法创建图片缓存目录: {e}"))?;
    Ok(dir)
}

pub(crate) fn cache_file_name(url: &str) -> String {
    let ext = url
        .rsplit('.')
        .next()
        .filter(|s| s.len() <= 5 && !s.contains('/'))
        .unwrap_or("png");
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    format!("{}.{}", &hash[..24], ext)
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("opgg-arena-toolbox/0.1")
        .build()
        .expect("构建 HTTP 客户端失败")
}

async fn ensure_cached(client: &reqwest::Client, dir: &Path, url: &str) -> Result<PathBuf, String> {
    let dest = dir.join(cache_file_name(url));
    if dest.exists() {
        return Ok(dest);
    }
    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("下载图片失败 {url}: {e}"))?
        .bytes()
        .await
        .map_err(|e| format!("读取图片内容失败 {url}: {e}"))?;
    let tmp = dest.with_extension("tmp");
    std::fs::write(&tmp, &bytes).map_err(|e| format!("写入图片缓存失败: {e}"))?;
    std::fs::rename(&tmp, &dest).map_err(|e| format!("落盘图片缓存失败: {e}"))?;
    Ok(dest)
}

/// 统计缓存目录中的文件数与总字节数（忽略子目录）。
pub(crate) fn summarize_cache_dir(dir: &Path) -> Result<(usize, u64), String> {
    if !dir.exists() {
        return Ok((0, 0));
    }
    let mut count = 0usize;
    let mut bytes = 0u64;
    for entry in std::fs::read_dir(dir).map_err(|e| format!("读取图片缓存目录失败: {e}"))? {
        let entry = entry.map_err(|e| format!("读取缓存条目失败: {e}"))?;
        let meta = entry.metadata().map_err(|e| format!("读取缓存元数据失败: {e}"))?;
        if meta.is_file() {
            count += 1;
            bytes += meta.len();
        }
    }
    Ok((count, bytes))
}

/// 清空图片缓存目录内所有文件，返回删除的文件数。
pub(crate) fn clear_cache_dir(dir: &Path) -> Result<usize, String> {
    if !dir.exists() {
        return Ok(0);
    }
    let mut removed = 0usize;
    for entry in std::fs::read_dir(dir).map_err(|e| format!("读取图片缓存目录失败: {e}"))? {
        let entry = entry.map_err(|e| format!("读取缓存条目失败: {e}"))?;
        let path = entry.path();
        if path.is_file() {
            std::fs::remove_file(&path).map_err(|e| format!("删除缓存文件失败 {}: {e}", path.display()))?;
            removed += 1;
        }
    }
    eprintln!("[images] 已清理图片缓存 {removed} 个文件（{})", dir.display());
    Ok(removed)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheInfo {
    pub file_count: usize,
    pub total_bytes: u64,
}

/// 单张图片按需缓存：找不到时下载一次，之后都从本地读。
#[tauri::command]
pub async fn get_cached_image_path(app: AppHandle, url: String) -> Result<String, String> {
    if url.is_empty() {
        return Err("图片地址为空".to_string());
    }
    let dir = image_cache_dir(&app)?;
    let client = http_client();
    let path = ensure_cached(&client, &dir, &url).await?;
    Ok(path.to_string_lossy().to_string())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheProgress {
    pub done: usize,
    pub total: usize,
}

/// 批量预缓存：数据更新完成后调用一次，把英雄头像/装备/海克斯图标都提前下载到本地，
/// 这样即使断网也能正常显示图标。内部限制并发，避免同时打开过多连接。
#[tauri::command]
pub async fn cache_images_bulk(app: AppHandle, urls: Vec<String>) -> Result<HashMap<String, String>, String> {
    let dir = image_cache_dir(&app)?;
    let client = http_client();

    let mut unique: Vec<String> = urls.into_iter().filter(|u| !u.is_empty()).collect();
    unique.sort();
    unique.dedup();
    let total = unique.len();
    eprintln!("[images] 开始批量缓存 {total} 张图片");

    let mut result = HashMap::with_capacity(total);
    const CONCURRENCY: usize = 8;
    let mut cursor = 0usize;
    let mut done = 0usize;

    while cursor < unique.len() {
        let end = (cursor + CONCURRENCY).min(unique.len());
        let batch = &unique[cursor..end];
        let download_futures = batch.iter().map(|url| {
            let client = client.clone();
            let dir = dir.clone();
            async move {
                let res = ensure_cached(&client, &dir, url).await;
                (url.clone(), res)
            }
        });
        let batch_results = futures_util::future::join_all(download_futures).await;
        for (url, res) in batch_results {
            done += 1;
            if let Ok(path) = res {
                result.insert(url, path.to_string_lossy().to_string());
            }
            // 下载失败的图片跳过即可（比如某张图临时 404），不影响其它图标，也不阻塞整体流程。
        }
        let _ = app.emit("image-cache-progress", ImageCacheProgress { done, total });
        cursor = end;
    }

    eprintln!("[images] 批量缓存完成：成功 {}/{}", result.len(), total);
    Ok(result)
}

#[tauri::command]
pub fn get_image_cache_info(app: AppHandle) -> Result<ImageCacheInfo, String> {
    let dir = image_cache_dir(&app)?;
    let (file_count, total_bytes) = summarize_cache_dir(&dir)?;
    Ok(ImageCacheInfo {
        file_count,
        total_bytes,
    })
}

#[tauri::command]
pub fn clear_image_cache(app: AppHandle) -> Result<ImageCacheInfo, String> {
    let dir = image_cache_dir(&app)?;
    clear_cache_dir(&dir)?;
    Ok(ImageCacheInfo {
        file_count: 0,
        total_bytes: 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("arena-img-cache-test-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn cache_file_name_is_stable_and_uses_extension() {
        let a = cache_file_name("https://cdn.example.com/foo/bar.png");
        let b = cache_file_name("https://cdn.example.com/foo/bar.png");
        assert_eq!(a, b);
        assert!(a.ends_with(".png"));
        assert_eq!(a.len(), 24 + 1 + 3);
    }

    #[test]
    fn cache_file_name_falls_back_when_extension_missing() {
        let name = cache_file_name("https://cdn.example.com/item/12345");
        assert!(name.ends_with(".png"));
    }

    #[test]
    fn summarize_and_clear_cache_dir() {
        let dir = temp_dir();
        fs::write(dir.join("a.png"), b"aaa").unwrap();
        fs::write(dir.join("b.webp"), b"bbbb").unwrap();

        let (count, bytes) = summarize_cache_dir(&dir).unwrap();
        assert_eq!(count, 2);
        assert_eq!(bytes, 7);

        let removed = clear_cache_dir(&dir).unwrap();
        assert_eq!(removed, 2);
        let (count2, bytes2) = summarize_cache_dir(&dir).unwrap();
        assert_eq!(count2, 0);
        assert_eq!(bytes2, 0);

        let _ = fs::remove_dir_all(&dir);
    }
}
