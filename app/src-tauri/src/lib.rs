mod images;
mod paths;
mod seed;
mod settings;
mod update;

use images::{cache_images_bulk, clear_image_cache, get_cached_image_path, get_image_cache_info};
use seed::import_bundled_data;
use settings::{get_settings, save_settings};
use update::{check_for_update, download_and_apply_update, get_local_data, get_local_manifest};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            seed::ensure_seed_data(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_local_data,
            get_local_manifest,
            check_for_update,
            download_and_apply_update,
            import_bundled_data,
            get_settings,
            save_settings,
            get_cached_image_path,
            cache_images_bulk,
            get_image_cache_info,
            clear_image_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
