//! Is a full screen app (a game, a video) in front right now?
//! The star hides itself while one is.

/// Asks the system about the window the user is working in.
pub struct Detector {
    #[cfg(target_os = "linux")]
    x11: Option<linux::X11>,
}

impl Detector {
    pub fn new() -> Self {
        Detector {
            #[cfg(target_os = "linux")]
            x11: linux::X11::connect(),
        }
    }

    /// `star` is the star's centre on the screen, in physical pixels. On
    /// Windows a full screen app only counts when it is on the star's monitor.
    #[allow(unused_variables)]
    pub fn fullscreen_in_front(&self, star: (i32, i32)) -> bool {
        #[cfg(windows)]
        {
            windows_impl::fullscreen_in_front(star)
        }
        #[cfg(target_os = "linux")]
        {
            self.x11.as_ref().map(|x| x.fullscreen_in_front()).unwrap_or(false)
        }
        #[cfg(not(any(windows, target_os = "linux")))]
        {
            false
        }
    }
}

/// Where the mouse is, in physical pixels. Windows only: other systems ask Tauri.
#[cfg(windows)]
pub fn cursor_position() -> Option<(i32, i32)> {
    windows_impl::cursor_position()
}

#[cfg(windows)]
mod windows_impl {
    use windows::Win32::Foundation::{POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows::Win32::System::Threading::GetCurrentProcessId;
    use windows::Win32::UI::Shell::{
        SHQueryUserNotificationState, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetCursorPos, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId, IsZoomed,
    };

    pub fn cursor_position() -> Option<(i32, i32)> {
        let mut p = POINT::default();
        unsafe { GetCursorPos(&mut p).ok()? };
        Some((p.x, p.y))
    }

    pub fn fullscreen_in_front(star: (i32, i32)) -> bool {
        // A game that owns the whole screen (exclusive full screen), or
        // Windows presentation mode.
        if let Ok(state) = unsafe { SHQueryUserNotificationState() } {
            if state == QUNS_RUNNING_D3D_FULL_SCREEN || state == QUNS_PRESENTATION_MODE {
                return true;
            }
        }

        // Otherwise: does the window in front cover its whole monitor?
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_invalid() {
                return false;
            }

            // Our own windows never count.
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == GetCurrentProcessId() {
                return false;
            }

            // The desktop itself and the taskbar cover the screen but are not apps.
            let mut name = [0u16; 64];
            let len = GetClassNameW(hwnd, &mut name).max(0) as usize;
            let class = String::from_utf16_lossy(&name[..len]);
            if matches!(class.as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd") {
                return false;
            }

            // A maximised window can cover the monitor when the taskbar is set
            // to hide itself. That is not full screen.
            if IsZoomed(hwnd).as_bool() {
                return false;
            }

            let mut rect = RECT::default();
            if GetWindowRect(hwnd, &mut rect).is_err() {
                return false;
            }
            let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
            let star_monitor = MonitorFromPoint(POINT { x: star.0, y: star.1 }, MONITOR_DEFAULTTONEAREST);
            if monitor != star_monitor {
                return false;
            }
            let mut info = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
            if !GetMonitorInfoW(monitor, &mut info).as_bool() {
                return false;
            }
            let m = info.rcMonitor;
            rect.left <= m.left && rect.top <= m.top && rect.right >= m.right && rect.bottom >= m.bottom
        }
    }
}

#[cfg(target_os = "linux")]
mod linux {
    //! X11 only. Under Wayland there is no way to ask, so the star stays visible.
    use x11rb::connection::Connection;
    use x11rb::protocol::xproto::{Atom, AtomEnum, ConnectionExt, Window};
    use x11rb::rust_connection::RustConnection;

    pub struct X11 {
        conn: RustConnection,
        root: Window,
        active_window: Atom,
        wm_state: Atom,
        fullscreen: Atom,
        wm_pid: Atom,
    }

    impl X11 {
        pub fn connect() -> Option<Self> {
            let (conn, screen) = x11rb::connect(None).ok()?;
            let root = conn.setup().roots.get(screen)?.root;
            let atom = |name: &str| -> Option<Atom> {
                Some(conn.intern_atom(false, name.as_bytes()).ok()?.reply().ok()?.atom)
            };
            let active_window = atom("_NET_ACTIVE_WINDOW")?;
            let wm_state = atom("_NET_WM_STATE")?;
            let fullscreen = atom("_NET_WM_STATE_FULLSCREEN")?;
            let wm_pid = atom("_NET_WM_PID")?;
            Some(X11 { conn, root, active_window, wm_state, fullscreen, wm_pid })
        }

        fn property(&self, window: Window, property: Atom, kind: AtomEnum) -> Vec<u32> {
            self.conn
                .get_property(false, window, property, kind, 0, 64)
                .ok()
                .and_then(|cookie| cookie.reply().ok())
                .and_then(|reply| reply.value32().map(|v| v.collect()))
                .unwrap_or_default()
        }

        pub fn fullscreen_in_front(&self) -> bool {
            let Some(&active) = self.property(self.root, self.active_window, AtomEnum::WINDOW).first() else {
                return false;
            };
            if active == 0 {
                return false;
            }
            if self.property(active, self.wm_pid, AtomEnum::CARDINAL).first() == Some(&std::process::id()) {
                return false;
            }
            self.property(active, self.wm_state, AtomEnum::ATOM).contains(&self.fullscreen)
        }
    }
}
