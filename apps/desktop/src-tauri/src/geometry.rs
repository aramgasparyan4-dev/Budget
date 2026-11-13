//! Pure maths for the star window. No system calls, so it can be unit tested.
//!
//! The star window is bigger than the star: the star sits in the middle and
//! there is empty, see-through room above and below it for the speech bubble.
//! All sizes here are in logical pixels (before display scaling).

/// Width of the star window.
pub const WINDOW_W: f64 = 440.0;
/// Room kept above and below the star for the speech bubble.
pub const BUBBLE_H: f64 = 130.0;
/// Widest the speech bubble gets.
pub const BUBBLE_W: f64 = 270.0;

// The star drawing uses a 240 unit box (see packages/star-view). Its points
// reach 92 units from the centre and its inner corners 56, plus about 11 for
// the rounded edge.
const VIEW: f64 = 240.0;
const OUTER: f64 = 103.0;
const INNER: f64 = 67.0;

/// Side length of the star drawing for a size setting.
pub fn star_size(size: &str) -> f64 {
    match size {
        "small" => 130.0,
        _ => 190.0,
    }
}

pub fn window_size(size: &str) -> (f64, f64) {
    (WINDOW_W, star_size(size) + 2.0 * BUBBLE_H)
}

/// Is a point on the star? `dx`, `dy` are measured from the star's centre and
/// `star` is the side length of the drawing, all in the same unit.
pub fn point_in_star(dx: f64, dy: f64, star: f64) -> bool {
    let k = star / VIEW;
    let (outer, inner) = (OUTER * k, INNER * k);
    let dist2 = dx * dx + dy * dy;
    if dist2 <= inner * inner {
        return true;
    }
    if dist2 > outer * outer {
        return false;
    }
    // Ten corners, starting at the top point and going clockwise.
    let mut inside = false;
    let corner = |i: usize| {
        let r = if i % 2 == 0 { outer } else { inner };
        let a = -std::f64::consts::FRAC_PI_2 + (i as f64) * std::f64::consts::PI / 5.0;
        (r * a.cos(), r * a.sin())
    };
    let mut j = 9;
    for i in 0..10 {
        let (xi, yi) = corner(i);
        let (xj, yj) = corner(j);
        if (yi > dy) != (yj > dy) && dx < (xj - xi) * (dy - yi) / (yj - yi) + xi {
            inside = !inside;
        }
        j = i;
    }
    inside
}

/// Which way the eyes look for a mouse at (`dx`, `dy`) from the star's
/// centre. Each part is -1, 0 or 1. Straight ahead when the mouse is close.
pub fn eye_direction(dx: f64, dy: f64, star: f64) -> (i8, i8) {
    let dist = (dx * dx + dy * dy).sqrt();
    if dist < star * 0.45 {
        return (0, 0);
    }
    let part = |v: f64| -> i8 {
        if v.abs() / dist < 0.38 {
            0
        } else if v > 0.0 {
            1
        } else {
            -1
        }
    };
    (part(dx), part(dy))
}

/// A rectangle on the screen: left, top, right, bottom.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub left: f64,
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
}

impl Rect {
    pub fn contains(&self, x: f64, y: f64) -> bool {
        x >= self.left && x < self.right && y >= self.top && y < self.bottom
    }
}

/// Where the speech bubble goes: above the star unless that would leave the
/// screen, and nudged sideways so it stays on the screen too.
/// `cx`, `cy` are the star's centre; everything is in the same unit.
pub fn bubble_layout(cx: f64, cy: f64, star: f64, screen: Rect) -> (bool, f64) {
    let below = cy - star / 2.0 - BUBBLE_H < screen.top;
    let margin = 8.0;
    let left = cx - BUBBLE_W / 2.0;
    let right = cx + BUBBLE_W / 2.0;
    let mut shift = 0.0;
    if left < screen.left + margin {
        shift = screen.left + margin - left;
    } else if right > screen.right - margin {
        shift = screen.right - margin - right;
    }
    let max = (WINDOW_W - BUBBLE_W) / 2.0;
    (below, shift.clamp(-max, max))
}

/// Top left corner for a side window (the list panel) of size `w` by `h`
/// next to the star, kept on the screen.
pub fn panel_position(cx: f64, cy: f64, star: f64, w: f64, h: f64, screen: Rect) -> (f64, f64) {
    let gap = 6.0;
    let screen_mid = (screen.left + screen.right) / 2.0;
    let x = if cx > screen_mid { cx - star / 2.0 - gap - w } else { cx + star / 2.0 + gap };
    let y = cy + star / 2.0 - h;
    (
        x.clamp(screen.left, (screen.right - w).max(screen.left)),
        y.clamp(screen.top, (screen.bottom - h).max(screen.top)),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCREEN: Rect = Rect { left: 0.0, top: 0.0, right: 1920.0, bottom: 1040.0 };

    #[test]
    fn centre_and_points_are_on_the_star() {
        assert!(point_in_star(0.0, 0.0, 190.0));
        assert!(point_in_star(0.0, -75.0, 190.0), "top point");
        assert!(point_in_star(40.0, 60.0, 190.0), "lower right leg");
    }

    #[test]
    fn gaps_between_points_are_not_on_the_star() {
        assert!(!point_in_star(0.0, 70.0, 190.0), "notch between the two legs");
        assert!(!point_in_star(70.0, -60.0, 190.0), "gap beside the top point");
        assert!(!point_in_star(0.0, -90.0, 190.0), "above the top point");
        assert!(!point_in_star(200.0, 0.0, 190.0));
    }

    #[test]
    fn hit_area_scales_with_the_star() {
        assert!(point_in_star(0.0, -75.0, 190.0));
        assert!(!point_in_star(0.0, -75.0, 130.0));
        assert!(point_in_star(0.0, -50.0, 130.0));
    }

    #[test]
    fn eyes_look_straight_when_the_mouse_is_near() {
        assert_eq!(eye_direction(10.0, -20.0, 190.0), (0, 0));
    }

    #[test]
    fn eyes_follow_the_mouse_in_eight_directions() {
        assert_eq!(eye_direction(500.0, 0.0, 190.0), (1, 0));
        assert_eq!(eye_direction(-500.0, 20.0, 190.0), (-1, 0));
        assert_eq!(eye_direction(0.0, -300.0, 190.0), (0, -1));
        assert_eq!(eye_direction(300.0, 300.0, 190.0), (1, 1));
        assert_eq!(eye_direction(-300.0, 250.0, 190.0), (-1, 1));
    }

    #[test]
    fn bubble_goes_above_when_there_is_room() {
        assert_eq!(bubble_layout(960.0, 800.0, 190.0, SCREEN), (false, 0.0));
    }

    #[test]
    fn bubble_goes_below_near_the_top_of_the_screen() {
        assert_eq!(bubble_layout(960.0, 150.0, 190.0, SCREEN), (true, 0.0));
    }

    #[test]
    fn bubble_is_nudged_in_from_the_screen_edges() {
        let (_, shift) = bubble_layout(1860.0, 800.0, 190.0, SCREEN);
        assert_eq!(shift, 1912.0 - (1860.0 + BUBBLE_W / 2.0));
        let (_, shift) = bubble_layout(60.0, 800.0, 190.0, SCREEN);
        assert_eq!(shift, 8.0 - (60.0 - BUBBLE_W / 2.0));
    }

    #[test]
    fn panel_opens_on_the_roomy_side_and_stays_on_screen() {
        // Star at the bottom right: panel to its left, bottom edges level.
        assert_eq!(panel_position(1800.0, 940.0, 190.0, 400.0, 600.0, SCREEN), (1299.0, 435.0));
        // Star at the top left: panel to its right, pushed down onto the screen.
        assert_eq!(panel_position(100.0, 100.0, 190.0, 400.0, 600.0, SCREEN), (201.0, 0.0));
    }
}
