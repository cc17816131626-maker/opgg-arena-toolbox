use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use crate::paths::{data_dir, local_data_path, local_manifest_path};
use crate::settings::touch_last_checked;

/// 远端 manifest.json 地址：抓取流水线（GitHub Actions）跑完之后会把最新的
/// manifest.json 提交到仓库的 data/ 目录，客户端通过 raw.githubusercontent.com
/// 读取这个文件就能拿到最新版本信息、下载地址和 sha256。
///
/// 仓库还没有推送到 GitHub 之前这里先放一个占位地址；真正发布时改成
/// `https://raw.githubusercontent.com/<owner>/<repo>/main/data/manifest.json` 即可，
/// 也可以在构建时用环境变量 `ARENA_MANIFEST_URL` 覆盖，不需要改代码。
const DEFAULT_MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/cc17816131626-maker/opgg-arena-toolbox/main/data/manifest.json";

fn manifest_url() -> String {
    option_env!("ARENA_MANIFEST_URL")
        .unwrap_or(DEFAULT_MANIFEST_URL)
        .to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Manifest {
    pub version: String,
    pub patch: String,
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
    #[serde(rename = "dataUrl")]
    pub data_url: String,
    pub sha256: String,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckUpdateResult {
    pub has_update: bool,
    pub remote_manifest: Manifest,
    pub local_manifest: Option<Manifest>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("opgg-arena-toolbox/0.1")
        .build()
        .expect("构建 HTTP 客户端失败")
}

async fn fetch_manifest_from_url(client: &reqwest::Client, url: &str) -> Result<Manifest, String> {
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("请求 manifest 失败: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("请求 manifest 失败，HTTP 状态码: {}", res.status()));
    }
    res.json::<Manifest>()
        .await
        .map_err(|e| format!("解析 manifest 失败: {e}"))
}

async fn fetch_remote_manifest() -> Result<Manifest, String> {
    fetch_manifest_from_url(&http_client(), &manifest_url()).await
}

/// 下载数据包并做 sha256 校验，返回校验通过的压缩字节；下载过程中通过
/// `on_progress(已下载字节, 总字节)` 回调上报进度。这个函数不依赖 AppHandle，
/// 方便在集成测试里对着本地假服务器跑一遍完整的下载+校验逻辑。
async fn download_and_verify(
    client: &reqwest::Client,
    data_url: &str,
    expected_sha256: &str,
    size_hint: u64,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<Vec<u8>, String> {
    let res = client
        .get(data_url)
        .send()
        .await
        .map_err(|e| format!("下载数据包失败: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("下载数据包失败，HTTP 状态码: {}", res.status()));
    }

    let total_bytes = res.content_length().unwrap_or(size_hint);
    let mut downloaded_bytes: u64 = 0;
    let mut compressed: Vec<u8> = Vec::with_capacity(total_bytes as usize);
    let mut stream = res.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载数据包中断: {e}"))?;
        downloaded_bytes += chunk.len() as u64;
        compressed.extend_from_slice(&chunk);
        on_progress(downloaded_bytes, total_bytes);
    }

    let actual_sha256 = {
        let mut hasher = Sha256::new();
        hasher.update(&compressed);
        format!("{:x}", hasher.finalize())
    };
    if actual_sha256 != expected_sha256 {
        return Err(format!(
            "数据包校验失败（期望 {}，实际 {}），已放弃这次更新，本地数据保持不变",
            expected_sha256, actual_sha256
        ));
    }

    Ok(compressed)
}

pub fn read_local_manifest(app: &AppHandle) -> Option<Manifest> {
    let path = local_manifest_path(app).ok()?;
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

#[tauri::command]
pub async fn get_local_manifest(app: AppHandle) -> Option<Manifest> {
    read_local_manifest(&app)
}

#[tauri::command]
pub fn get_local_data(app: AppHandle) -> Result<Option<String>, String> {
    let path = local_data_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("读取本地数据失败: {e}"))
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<CheckUpdateResult, String> {
    let remote = fetch_remote_manifest().await?;
    let local = read_local_manifest(&app);
    let has_update = local.as_ref().map(|m| m.version != remote.version).unwrap_or(true);
    let _ = touch_last_checked(&app);
    Ok(CheckUpdateResult {
        has_update,
        remote_manifest: remote,
        local_manifest: local,
    })
}

#[tauri::command]
pub async fn download_and_apply_update(app: AppHandle) -> Result<Manifest, String> {
    let remote = fetch_remote_manifest().await?;

    let compressed = download_and_verify(
        &http_client(),
        &remote.data_url,
        &remote.sha256,
        remote.size_bytes,
        |downloaded_bytes, total_bytes| {
            let _ = app.emit(
                "download-progress",
                DownloadProgress {
                    downloaded_bytes,
                    total_bytes,
                },
            );
        },
    )
    .await?;

    let json_bytes = decompress_gzip(&compressed)?;

    let dir = data_dir(&app)?;
    let tmp_data_path = dir.join("arena-data.json.tmp");
    let tmp_manifest_path = dir.join("manifest.json.tmp");
    std::fs::write(&tmp_data_path, &json_bytes).map_err(|e| format!("写入临时数据文件失败: {e}"))?;
    std::fs::write(&tmp_manifest_path, serde_json::to_vec_pretty(&remote).unwrap())
        .map_err(|e| format!("写入临时 manifest 失败: {e}"))?;

    // 用 rename 做原子替换：要么整个数据文件都是新的，要么还是旧的，
    // 不会出现读到“一半新一半旧”的数据。
    std::fs::rename(&tmp_data_path, local_data_path(&app)?).map_err(|e| format!("替换数据文件失败: {e}"))?;
    std::fs::rename(&tmp_manifest_path, local_manifest_path(&app)?).map_err(|e| format!("替换 manifest 失败: {e}"))?;

    let _ = touch_last_checked(&app);
    Ok(remote)
}

fn decompress_gzip(bytes: &[u8]) -> Result<Vec<u8>, String> {
    use flate2::read::GzDecoder;
    use std::io::Read;

    let mut decoder = GzDecoder::new(bytes);
    let mut out = Vec::new();
    decoder
        .read_to_end(&mut out)
        .map_err(|e| format!("解压数据包失败: {e}"))?;
    Ok(out)
}

/// 针对更新机制的集成测试：起一个本地假的 HTTP 服务器（wiremock），
/// 完整走一遍「请求 manifest → 流式下载 → sha256 校验 → gzip 解压」的真实代码路径，
/// 而不是靠肉眼看编译通过就当作测试过了。
#[cfg(test)]
mod tests {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn gzip(bytes: &[u8]) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(bytes).unwrap();
        encoder.finish().unwrap()
    }

    fn sha256_hex(bytes: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        format!("{:x}", hasher.finalize())
    }

    fn sample_manifest(server_uri: &str, sha256: &str, size_bytes: u64) -> Manifest {
        Manifest {
            version: "test-2026.07.01".to_string(),
            patch: "16.13".to_string(),
            generated_at: "2026-07-01T00:00:00Z".to_string(),
            data_url: format!("{server_uri}/arena-data.json.gz"),
            sha256: sha256.to_string(),
            size_bytes,
        }
    }

    #[tokio::test]
    async fn fetch_manifest_from_url_parses_real_response() {
        let server = MockServer::start().await;
        let manifest = sample_manifest(&server.uri(), "deadbeef", 123);
        Mock::given(method("GET"))
            .and(path("/manifest.json"))
            .respond_with(ResponseTemplate::new(200).set_body_json(&manifest))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let fetched = fetch_manifest_from_url(&client, &format!("{}/manifest.json", server.uri()))
            .await
            .expect("应当成功拉取并解析 manifest");

        assert_eq!(fetched, manifest);
    }

    #[tokio::test]
    async fn fetch_manifest_from_url_propagates_http_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/manifest.json"))
            .respond_with(ResponseTemplate::new(404))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let err = fetch_manifest_from_url(&client, &format!("{}/manifest.json", server.uri()))
            .await
            .expect_err("404 应该返回 Err 而不是静默成功");
        assert!(err.contains("404"));
    }

    #[tokio::test]
    async fn download_and_verify_succeeds_and_reports_progress() {
        let original = br#"{"champions":["darius","ahri"],"patch":"16.13"}"#.to_vec();
        let compressed = gzip(&original);
        let sha256 = sha256_hex(&compressed);

        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/arena-data.json.gz"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(compressed.clone()))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let mut progress_events: Vec<(u64, u64)> = Vec::new();
        let downloaded = download_and_verify(
            &client,
            &format!("{}/arena-data.json.gz", server.uri()),
            &sha256,
            compressed.len() as u64,
            |downloaded_bytes, total_bytes| progress_events.push((downloaded_bytes, total_bytes)),
        )
        .await
        .expect("校验应当通过且下载成功");

        assert_eq!(downloaded, compressed, "下载回来的压缩字节应与源数据完全一致");
        assert!(!progress_events.is_empty(), "下载过程中应至少上报一次进度");
        let (last_downloaded, _) = *progress_events.last().unwrap();
        assert_eq!(last_downloaded, compressed.len() as u64, "最后一次进度应等于总字节数");

        let decompressed = decompress_gzip(&downloaded).expect("gzip 解压应当成功");
        assert_eq!(decompressed, original, "解压结果应还原成原始 JSON 字节");
    }

    #[tokio::test]
    async fn download_and_verify_rejects_corrupted_or_tampered_data() {
        let original = br#"{"champions":["darius"]}"#.to_vec();
        let compressed = gzip(&original);
        // 故意给一个错误的 sha256，模拟数据在传输途中被破坏/篡改的情况
        let wrong_sha256 = "0".repeat(64);

        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/arena-data.json.gz"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(compressed.clone()))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let err = download_and_verify(
            &client,
            &format!("{}/arena-data.json.gz", server.uri()),
            &wrong_sha256,
            compressed.len() as u64,
            |_, _| {},
        )
        .await
        .expect_err("sha256 不匹配时必须拒绝这次更新，不能悄悄接受坏数据");

        assert!(err.contains("校验失败"), "错误信息应说明是校验失败: {err}");
    }

    #[tokio::test]
    async fn download_and_verify_propagates_http_error_without_panicking() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/arena-data.json.gz"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let err = download_and_verify(
            &client,
            &format!("{}/arena-data.json.gz", server.uri()),
            "irrelevant",
            0,
            |_, _| {},
        )
        .await
        .expect_err("服务器 500 时应返回 Err");
        assert!(err.contains("500"));
    }

    #[test]
    fn decompress_gzip_roundtrip() {
        let original = b"hello arena".to_vec();
        let compressed = gzip(&original);
        let decompressed = decompress_gzip(&compressed).expect("应当解压成功");
        assert_eq!(decompressed, original);
    }

    #[test]
    fn decompress_gzip_rejects_non_gzip_bytes() {
        let err = decompress_gzip(b"not gzip data").expect_err("非 gzip 数据应当返回错误而不是 panic");
        assert!(err.contains("解压"));
    }
}
