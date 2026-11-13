//! Star Companion desktop shell.
//!
//! This side owns the windows, the tray icon, the files on disk and the
//! things only native code can do: letting clicks pass through the empty
//! parts of the star window, following the mouse for the eyes, and hiding
//! while a full screen app is in front. All study logic lives in the shared
//! TypeScript core and runs inside the windows.

mod fullscreen;
mod geometry;
mod storage;

use geometry::Rect;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use storage::Prefs;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, RunEvent, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent, Wry,
};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const STAR: &str = "star";
const PANEL: &str = "panel";
const QUICK_ADD: &str = "quickadd";
const TRAY: &str = "main";

const PANEL_SIZE: (f64, f64) = (400.0, 620.0);
const QUICK_ADD_SIZE: (f64, f64) = (640.0, 200.0);

/// Where the star window is, in physical pixels, and its display scaling.
#[derive(Clone, Copy)]
struct StarPlace {
    x: i32,
    y: i32,
    scale: f64,
}

pub struct AppState {
    dir: PathBuf,
    /// The user's data as JSON text. The windows read and write it whole.
    data: Mutex<String>,
    prefs: Mutex<Prefs>,
    place: Mutex<StarPlace>,
    /// Goes up whenever the star window moves or changes, so the watcher
    /// knows to redo its sums even if the mouse did not move.
    place_version: AtomicU64,
    moved_at: Mutex<Option<Instant>>,
    /// Hidden right now because a full screen app is in front.
    auto_hidden: AtomicBool,
}

impl AppState {
    fn prefs(&self) -> Prefs {
        self.prefs.lock().unwrap().clone()
    }

    fn place(&self) -> StarPlace {
        *self.place.lock().unwrap()
    }

    fn touch(&self) {
        self.place_version.fetch_add(1, Ordering::Relaxed);
    }
}

// ------------------------------------------------------------ geometry

/// Centre of the star on the screen, in physical pixels.
fn star_center(app: &AppHandle) -> (f64, f64) {
    let state = app.state::<AppState>();
    let place = state.place();
    let (w, h) = geometry::window_size(&state.prefs().size);
    (place.x as f64 + w * place.scale / 2.0, place.y as f64 + h * place.scale / 2.0)
}

struct Screen {
    /// The whole monitor.
    full: Rect,
    /// The monitor without the taskbar.
    work: Rect,
    scale: f64,
}

fn screen_of(monitor: &tauri::Monitor) -> Screen {
    let rect = |x: i32, y: i32, w: u32, h: u32| Rect {
        left: x as f64,
        top: y as f64,
        right: x as f64 + w as f64,
        bottom: y as f64 + h as f64,
    };
    let (p, s) = (monitor.position(), monitor.size());
    let work = monitor.work_area();
    Screen {
        full: rect(p.x, p.y, s.width, s.height),
        work: rect(work.position.x, work.position.y, work.size.width, work.size.height),
        scale: monitor.scale_factor(),
    }
}

/// The monitor a point is on, or the main monitor if it is on none.
fn screen_at(app: &AppHandle, x: f64, y: f64) -> Option<Screen> {
    let screens: Vec<Screen> = app.available_monitors().ok()?.iter().map(screen_of).collect();
    if let Some(found) = screens.into_iter().find(|s| s.full.contains(x, y)) {
        return Some(found);
    }
    app.primary_monitor().ok().flatten().as_ref().map(screen_of)
}

/// Bottom right corner of the main monitor, clear of the taskbar.
fn default_position(app: &AppHandle, size: &str) -> (i32, i32) {
    let (w, h) = geometry::window_size(size);
    match app.primary_monitor().ok().flatten().as_ref().map(screen_of) {
        Some(screen) => {
            let cx = screen.work.right - 150.0 * screen.scale;
            let cy = screen.work.bottom - 130.0 * screen.scale;
            ((cx - w * screen.scale / 2.0).round() as i32, (cy - h * screen.scale / 2.0).round() as i32)
        }
        None => (200, 200),
    }
}

// --------------------------------------------------------- star window

fn create_star(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let state = app.state::<AppState>();
    let prefs = state.prefs();
    let (w, h) = geometry::window_size(&prefs.size);

    let window = WebviewWindowBuilder::new(app, STAR, WebviewUrl::App("star.html".into()))
        .title("Star Companion")
        .inner_size(w, h)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .focused(false)
        .visible(false)
        .build()?;

    // Put it back where it was left, unless that spot is no longer on a screen
    // (for example a second monitor that has been unplugged).
    let scale = window.scale_factor().unwrap_or(1.0);
    let saved = prefs.x.zip(prefs.y).filter(|(x, y)| {
        let (cx, cy) = (*x as f64 + w * scale / 2.0, *y as f64 + h * scale / 2.0);
        app.available_monitors()
            .map(|monitors| monitors.iter().any(|m| screen_of(m).full.contains(cx, cy)))
            .unwrap_or(false)
    });
    let (x, y) = saved.unwrap_or_else(|| default_position(app, &prefs.size));
    window.set_position(PhysicalPosition::new(x, y))?;
    *state.place.lock().unwrap() = StarPlace { x, y, scale: window.scale_factor().unwrap_or(scale) };

    // Clicks pass through until the watcher sees the mouse over the star.
    window.set_ignore_cursor_events(true)?;

    let handle = app.clone();
    window.on_window_event(move |event| {
        let state = handle.state::<AppState>();
        match event {
            WindowEvent::Moved(position) => {
                {
                    let mut place = state.place.lock().unwrap();
                    place.x = position.x;
                    place.y = position.y;
                }
                *state.moved_at.lock().unwrap() = Some(Instant::now());
                state.touch();
            }
            WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
                state.place.lock().unwrap().scale = *scale_factor;
                state.touch();
            }
            // Alt+F4 must not kill the star. Quit is in the tray menu.
            WindowEvent::CloseRequested { api, .. } => api.prevent_close(),
            _ => {}
        }
    });
    Ok(window)
}

/// Shows or hides the star to match the user's choice and full screen state.
fn refresh_star_visibility(app: &AppHandle) {
    let state = app.state::<AppState>();
    let hidden = state.prefs().star_hidden || state.auto_hidden.load(Ordering::Relaxed);
    if let Some(window) = app.get_webview_window(STAR) {
        let _ = if hidden { window.hide() } else { window.show() };
    }
    state.touch();
    let _ = app.emit_to(STAR, "star-visible", !hidden);
}

/// Changes the star's size while keeping its centre where it is.
fn apply_size(app: &AppHandle, size: &str) {
    let state = app.state::<AppState>();
    let (cx, cy) = star_center(app);
    state.prefs.lock().unwrap().size = size.to_string();
    let (w, h) = geometry::window_size(size);
    if let Some(window) = app.get_webview_window(STAR) {
        let scale = state.place().scale;
        let _ = window.set_size(LogicalSize::new(w, h));
        let (x, y) = ((cx - w * scale / 2.0).round() as i32, (cy - h * scale / 2.0).round() as i32);
        let _ = window.set_position(PhysicalPosition::new(x, y));
        let mut place = state.place.lock().unwrap();
        place.x = x;
        place.y = y;
    }
    state.touch();
}

// -------------------------------------------------------- side windows

/// Runs `then` with a side window, creating it first if needed.
///
/// Windows are created on a separate thread: on Windows, creating one from a
/// menu or shortcut handler on the main thread can freeze the app.
fn with_side_window(app: &AppHandle, label: &'static str, then: impl FnOnce(&AppHandle, WebviewWindow) + Send + 'static) {
    if let Some(window) = app.get_webview_window(label) {
        then(app, window);
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        let (page, (w, h)) = if label == PANEL { ("panel.html", PANEL_SIZE) } else { ("quickadd.html", QUICK_ADD_SIZE) };
        let built = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(page.into()))
            .title("Star Companion")
            .inner_size(w, h)
            .transparent(true)
            .decorations(false)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .maximizable(false)
            .minimizable(false)
            .visible(false)
            .build();
        let Ok(window) = built else { return };

        let handle = app.clone();
        window.on_window_event(move |event| match event {
            // Closing only hides, so the window opens instantly next time.
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if let Some(w) = handle.get_webview_window(label) {
                    let _ = w.hide();
                }
            }
            // Quick add goes away as soon as you click elsewhere.
            WindowEvent::Focused(false) if label == QUICK_ADD => {
                if let Some(w) = handle.get_webview_window(label) {
                    let _ = w.hide();
                }
            }
            _ => {}
        });
        then(&app, window);
    });
}

fn show_panel(app: &AppHandle) {
    with_side_window(app, PANEL, |app, window| {
        let (cx, cy) = star_center(app);
        if let Some(screen) = screen_at(app, cx, cy) {
            let s = screen.scale;
            let star = geometry::star_size(&app.state::<AppState>().prefs().size) * s;
            let (x, y) = geometry::panel_position(cx, cy, star, PANEL_SIZE.0 * s, PANEL_SIZE.1 * s, screen.work);
            let _ = window.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
        }
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit_to(PANEL, "window-shown", ());
    });
}

fn toggle_panel_window(app: &AppHandle) {
    match app.get_webview_window(PANEL) {
        Some(window) if window.is_visible().unwrap_or(false) => {
            let _ = window.hide();
        }
        _ => show_panel(app),
    }
}

fn show_quick_add(app: &AppHandle) {
    with_side_window(app, QUICK_ADD, |app, window| {
        // On the monitor the mouse is on, a little above the middle.
        let cursor = cursor_position(app).unwrap_or((0, 0));
        if let Some(screen) = screen_at(app, cursor.0 as f64, cursor.1 as f64) {
            let s = screen.scale;
            let x = (screen.work.left + screen.work.right) / 2.0 - QUICK_ADD_SIZE.0 * s / 2.0;
            let y = screen.work.top + (screen.work.bottom - screen.work.top) * 0.22;
            let _ = window.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
        }
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit_to(QUICK_ADD, "window-shown", ());
    });
}

// ---------------------------------------------------------------- menu

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let prefs = app.state::<AppState>().prefs();
    let autostart = app.autolaunch().is_enabled().unwrap_or(false);
    let item = |id: &str, text: &str| MenuItem::with_id(app, id, text, true, None::<&str>);
    let check = |id: &str, text: &str, on: bool| CheckMenuItem::with_id(app, id, text, true, on, None::<&str>);

    let size = Submenu::with_items(
        app,
        "Size",
        true,
        &[&check("size_normal", "Normal", prefs.size != "small")?, &check("size_small", "Small", prefs.size == "small")?],
    )?;

    Menu::with_items(
        app,
        &[
            &item("quick_add", "Quick add (Ctrl+Shift+A)")?,
            &item("open_panel", "Open my list")?,
            &PredefinedMenuItem::separator(app)?,
            &item("snooze_60", "Snooze for 1 hour")?,
            &item("snooze_clear", "End snooze")?,
            &item("day_off", "Day off today (on / off)")?,
            &PredefinedMenuItem::separator(app)?,
            &size,
            &check("autostart", "Start when I log in", autostart)?,
            &check("hide_fullscreen", "Hide during full screen apps", prefs.hide_on_fullscreen)?,
            &check("sound", "Sound when a focus session ends", prefs.sound)?,
            &item("toggle_star", if prefs.star_hidden { "Show the star" } else { "Hide the star" })?,
            &PredefinedMenuItem::separator(app)?,
            &item("quit", "Quit")?,
        ],
    )
}

/// Call after any preference changes: saves, updates the tray's tick marks,
/// and tells the windows.
fn prefs_changed(app: &AppHandle) {
    let state = app.state::<AppState>();
    storage::save_prefs(&state.dir, &state.prefs());
    if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY), build_menu(app)) {
        let _ = tray.set_menu(Some(menu));
    }
    let _ = app.emit("prefs-changed", ());
}

fn set_preference(app: &AppHandle, key: &str, value: Option<bool>, text: Option<&str>) {
    let state = app.state::<AppState>();
    match key {
        "size" => apply_size(app, if text == Some("small") { "small" } else { "normal" }),
        "autostart" => {
            let launcher = app.autolaunch();
            let want = value.unwrap_or(!launcher.is_enabled().unwrap_or(false));
            let _ = if want { launcher.enable() } else { launcher.disable() };
        }
        "hideOnFullscreen" => {
            let mut prefs = state.prefs.lock().unwrap();
            prefs.hide_on_fullscreen = value.unwrap_or(!prefs.hide_on_fullscreen);
        }
        "sound" => {
            let mut prefs = state.prefs.lock().unwrap();
            prefs.sound = value.unwrap_or(!prefs.sound);
        }
        "starHidden" => {
            {
                let mut prefs = state.prefs.lock().unwrap();
                prefs.star_hidden = value.unwrap_or(!prefs.star_hidden);
            }
            refresh_star_visibility(app);
        }
        _ => return,
    }
    prefs_changed(app);
}

fn on_menu(app: &AppHandle, id: &str) {
    match id {
        "quick_add" => show_quick_add(app),
        "open_panel" => show_panel(app),
        // These change the user's data, which the star window looks after.
        "snooze_60" | "snooze_clear" | "day_off" => {
            let _ = app.emit_to(STAR, "menu-action", id);
        }
        "size_normal" => set_preference(app, "size", None, Some("normal")),
        "size_small" => set_preference(app, "size", None, Some("small")),
        "autostart" => set_preference(app, "autostart", None, None),
        "hide_fullscreen" => set_preference(app, "hideOnFullscreen", None, None),
        "sound" => set_preference(app, "sound", None, None),
        "toggle_star" => set_preference(app, "starHidden", None, None),
        "quit" => app.exit(0),
        _ => {}
    }
}

// ------------------------------------------------------------- watcher

fn cursor_position(app: &AppHandle) -> Option<(i32, i32)> {
    #[cfg(windows)]
    {
        let _ = app;
        fullscreen::cursor_position()
    }
    #[cfg(not(windows))]
    {
        app.cursor_position().ok().map(|p| (p.x.round() as i32, p.y.round() as i32))
    }
}

/// One background thread does all the watching. It sleeps between looks and
/// only talks to the star window when something actually changed, so the app
/// uses next to no CPU while nothing is happening.
fn spawn_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let detector = fullscreen::Detector::new();
        let mut last_cursor: Option<(i32, i32)> = None;
        let mut last_version = u64::MAX;
        let mut ignoring: Option<bool> = None;
        let mut eyes = (0i8, 0i8);
        let mut moved = Instant::now();
        let mut slow_tick = Instant::now();
        let mut fullscreen_seen = 0u8;

        loop {
            // Look 25 times a second while the mouse is moving, 5 times a
            // second once it has been still for a few seconds.
            let resting = moved.elapsed() > Duration::from_secs(3);
            std::thread::sleep(Duration::from_millis(if resting { 200 } else { 40 }));
            let state = app.state::<AppState>();

            if slow_tick.elapsed() >= Duration::from_secs(1) {
                slow_tick = Instant::now();

                // Full screen app in front? Needs two looks in a row to hide,
                // so a window flashing past does not make the star blink.
                let center = star_center(&app);
                let on = state.prefs().hide_on_fullscreen
                    && detector.fullscreen_in_front((center.0.round() as i32, center.1.round() as i32));
                fullscreen_seen = if on { fullscreen_seen.saturating_add(1) } else { 0 };
                let hide = fullscreen_seen >= 2;
                if state.auto_hidden.swap(hide, Ordering::Relaxed) != hide {
                    refresh_star_visibility(&app);
                }

                // Remember where the star was dragged to, once it has settled.
                let settled = {
                    let mut moved_at = state.moved_at.lock().unwrap();
                    match *moved_at {
                        Some(at) if at.elapsed() > Duration::from_millis(800) => {
                            *moved_at = None;
                            true
                        }
                        _ => false,
                    }
                };
                if settled {
                    let place = state.place();
                    {
                        let mut prefs = state.prefs.lock().unwrap();
                        prefs.x = Some(place.x);
                        prefs.y = Some(place.y);
                    }
                    storage::save_prefs(&state.dir, &state.prefs());
                }
            }

            let prefs = state.prefs();
            if prefs.star_hidden || state.auto_hidden.load(Ordering::Relaxed) {
                continue;
            }
            let Some(cursor) = cursor_position(&app) else { continue };
            let version = state.place_version.load(Ordering::Relaxed);
            let window_changed = version != last_version;
            if Some(cursor) == last_cursor && !window_changed {
                continue;
            }
            if Some(cursor) != last_cursor {
                moved = Instant::now();
            }
            last_cursor = Some(cursor);
            last_version = version;

            let place = state.place();
            let star = geometry::star_size(&prefs.size) * place.scale;
            let (cx, cy) = star_center(&app);
            let (dx, dy) = (cursor.0 as f64 - cx, cursor.1 as f64 - cy);

            // Clicks go through the window unless the mouse is on the star.
            let ignore = !geometry::point_in_star(dx, dy, star);
            if window_changed || ignoring != Some(ignore) {
                if let Some(window) = app.get_webview_window(STAR) {
                    if window.set_ignore_cursor_events(ignore).is_ok() {
                        ignoring = Some(ignore);
                    }
                }
            }

            let direction = geometry::eye_direction(dx, dy, star);
            if direction != eyes {
                eyes = direction;
                let _ = app.emit_to(STAR, "eyes", direction);
            }
        }
    });
}

// ------------------------------------------------------------ commands

#[tauri::command]
fn get_data(state: State<AppState>) -> String {
    state.data.lock().unwrap().clone()
}

#[tauri::command]
fn set_data(app: AppHandle, state: State<AppState>, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| format!("not valid JSON: {e}"))?;
    storage::write_atomic(&state.dir.join(storage::DATA_FILE), &json).map_err(|e| e.to_string())?;
    *state.data.lock().unwrap() = json;
    let _ = app.emit("data-changed", ());
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PrefsView {
    size: String,
    hide_on_fullscreen: bool,
    sound: bool,
    star_hidden: bool,
    autostart: bool,
    /// Side length of the star drawing, in CSS pixels.
    star_size: f64,
    bubble_height: f64,
    bubble_width: f64,
    data_folder: String,
}

#[tauri::command]
fn get_prefs(app: AppHandle, state: State<AppState>) -> PrefsView {
    let prefs = state.prefs();
    PrefsView {
        star_size: geometry::star_size(&prefs.size),
        size: prefs.size,
        hide_on_fullscreen: prefs.hide_on_fullscreen,
        sound: prefs.sound,
        star_hidden: prefs.star_hidden,
        autostart: app.autolaunch().is_enabled().unwrap_or(false),
        bubble_height: geometry::BUBBLE_H,
        bubble_width: geometry::BUBBLE_W,
        data_folder: state.dir.to_string_lossy().into_owned(),
    }
}

#[tauri::command]
fn set_pref(app: AppHandle, key: String, value: serde_json::Value) {
    set_preference(&app, &key, value.as_bool(), value.as_str());
}

#[tauri::command]
fn toggle_panel(app: AppHandle) {
    toggle_panel_window(&app);
}

#[tauri::command]
fn open_quick_add(app: AppHandle) {
    show_quick_add(&app);
}

#[tauri::command]
fn hide_self(window: WebviewWindow) {
    let _ = window.hide();
}

/// The right click menu on the star. Same menu as the tray icon.
#[tauri::command]
fn show_menu(app: AppHandle, window: WebviewWindow) {
    if let Ok(menu) = build_menu(&app) {
        let _ = window.popup_menu(&menu);
    }
}

#[derive(Serialize)]
struct BubbleLayout {
    /// Draw the bubble under the star instead of over it.
    below: bool,
    /// Sideways nudge in CSS pixels to keep the bubble on the screen.
    shift: f64,
}

#[tauri::command]
fn bubble_layout(app: AppHandle, state: State<AppState>) -> BubbleLayout {
    let (cx, cy) = star_center(&app);
    let Some(screen) = screen_at(&app, cx, cy) else {
        return BubbleLayout { below: false, shift: 0.0 };
    };
    let s = screen.scale;
    let work = Rect {
        left: screen.work.left / s,
        top: screen.work.top / s,
        right: screen.work.right / s,
        bottom: screen.work.bottom / s,
    };
    let star = geometry::star_size(&state.prefs().size);
    let (below, shift) = geometry::bubble_layout(cx / s, cy / s, star, work);
    BubbleLayout { below, shift }
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

// ----------------------------------------------------------------- run

pub fn run() {
    let app = tauri::Builder::default()
        // Starting the app twice just brings the first star back.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            set_preference(app, "starHidden", Some(false), None);
        }))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        show_quick_add(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_data,
            set_data,
            get_prefs,
            set_pref,
            toggle_panel,
            open_quick_add,
            hide_self,
            show_menu,
            bubble_layout,
            quit
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // STAR_DATA_DIR lets tests use a throwaway folder.
            let dir = match std::env::var_os("STAR_DATA_DIR") {
                Some(dir) => PathBuf::from(dir),
                None => app.path().app_data_dir()?,
            };
            std::fs::create_dir_all(&dir)?;

            app.manage(AppState {
                data: Mutex::new(storage::load_data(&dir)),
                prefs: Mutex::new(storage::load_prefs(&dir)),
                dir,
                place: Mutex::new(StarPlace { x: 0, y: 0, scale: 1.0 }),
                place_version: AtomicU64::new(0),
                moved_at: Mutex::new(None),
                auto_hidden: AtomicBool::new(false),
            });

            create_star(&handle)?;

            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;
            TrayIconBuilder::with_id(TRAY)
                .icon(icon)
                .tooltip("Star Companion")
                .menu(&build_menu(&handle)?)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        toggle_panel_window(tray.app_handle());
                    }
                })
                .build(app)?;
            app.on_menu_event(|app, event| on_menu(app, event.id().as_ref()));

            // If another program already owns Ctrl+Shift+A, carry on without
            // it: quick add is still in the tray menu.
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyA);
            if let Err(error) = app.global_shortcut().register(shortcut) {
                eprintln!("Could not register Ctrl+Shift+A: {error}");
            }

            refresh_star_visibility(&handle);
            spawn_watcher(handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while starting Star Companion");

    app.run(|_app, event| {
        // The star has no normal window to close, so the app only ends
        // through Quit in the menu.
        if let RunEvent::ExitRequested { api, code, .. } = event {
            if code.is_none() {
                api.prevent_exit();
            }
        }
    });
}
