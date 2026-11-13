//! Files on disk: the user's data and this PC's own preferences.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub const DATA_FILE: &str = "data.json";
pub const PREFS_FILE: &str = "desktop-prefs.json";

/// Settings that belong to this PC only. They are not synced.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Prefs {
    /// "normal" or "small"
    pub size: String,
    /// Where the star window was left, in physical pixels.
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub hide_on_fullscreen: bool,
    pub sound: bool,
    /// Hidden by the user from the tray menu.
    pub star_hidden: bool,
}

impl Default for Prefs {
    fn default() -> Self {
        Prefs { size: "normal".into(), x: None, y: None, hide_on_fullscreen: true, sound: true, star_hidden: false }
    }
}

/// Writes a file in one step: write a temporary file, then rename it over the
/// real one. A crash or power cut cannot leave a half written file.
pub fn write_atomic(path: &Path, contents: &str) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("tmp");
    {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(contents.as_bytes())?;
        file.sync_all()?;
    }
    fs::rename(&tmp, path)
}

/// Reads the data file. Returns an empty string when there is none yet.
/// A file that is not valid JSON is kept under another name, never deleted.
pub fn load_data(dir: &Path) -> String {
    let path = dir.join(DATA_FILE);
    let Ok(text) = fs::read_to_string(&path) else {
        return String::new();
    };
    if serde_json::from_str::<serde_json::Value>(&text).is_ok() {
        return text;
    }
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let _ = fs::rename(&path, dir.join(format!("data.broken-{stamp}.json")));
    String::new()
}

pub fn load_prefs(dir: &Path) -> Prefs {
    fs::read_to_string(dir.join(PREFS_FILE))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub fn save_prefs(dir: &Path, prefs: &Prefs) {
    if let Ok(text) = serde_json::to_string_pretty(prefs) {
        let _ = write_atomic(&dir.join(PREFS_FILE), &text);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("star-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn missing_data_file_reads_as_empty() {
        let dir = temp_dir("missing");
        assert_eq!(load_data(&dir), "");
    }

    #[test]
    fn data_round_trips() {
        let dir = temp_dir("roundtrip");
        write_atomic(&dir.join(DATA_FILE), r#"{"tasks":[]}"#).unwrap();
        assert_eq!(load_data(&dir), r#"{"tasks":[]}"#);
        assert!(!dir.join("data.tmp").exists());
    }

    #[test]
    fn broken_data_file_is_kept_aside() {
        let dir = temp_dir("broken");
        fs::write(dir.join(DATA_FILE), "{ not json").unwrap();
        assert_eq!(load_data(&dir), "");
        assert!(!dir.join(DATA_FILE).exists());
        let kept = fs::read_dir(&dir).unwrap().filter_map(|e| e.ok()).any(|e| {
            e.file_name().to_string_lossy().starts_with("data.broken-")
        });
        assert!(kept);
    }

    #[test]
    fn prefs_default_and_round_trip() {
        let dir = temp_dir("prefs");
        assert_eq!(load_prefs(&dir), Prefs::default());
        let prefs = Prefs { size: "small".into(), x: Some(10), y: Some(-20), ..Prefs::default() };
        save_prefs(&dir, &prefs);
        assert_eq!(load_prefs(&dir), prefs);
    }

    #[test]
    fn prefs_from_an_older_version_fill_in_new_fields() {
        let dir = temp_dir("oldprefs");
        fs::write(dir.join(PREFS_FILE), r#"{"size":"small"}"#).unwrap();
        let prefs = load_prefs(&dir);
        assert_eq!(prefs.size, "small");
        assert!(prefs.hide_on_fullscreen);
    }
}
