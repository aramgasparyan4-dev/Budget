// Keyboard + mouse input with pointer lock (and drag-to-look fallback when
// pointer lock is unavailable, e.g. in automated tests).

type Listener = (code: string) => void;

export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  dragging = false;
  private onPress: Listener[] = [];
  private el: HTMLElement | null = null;
  /** when false, gameplay keys are ignored (UI has focus) */
  enabled = true;
  /** called when pointer lock is lost while playing */
  onUnlock: (() => void) | null = null;

  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.kd, { capture: true });
    window.addEventListener('keyup', this.ku, { capture: true });
    window.addEventListener('blur', this.blur);
    el.addEventListener('mousedown', this.md);
    window.addEventListener('mouseup', this.mu);
    window.addEventListener('mousemove', this.mm);
    el.addEventListener('wheel', this.wh, { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', this.plc);
  }

  detach() {
    window.removeEventListener('keydown', this.kd, { capture: true });
    window.removeEventListener('keyup', this.ku, { capture: true });
    window.removeEventListener('blur', this.blur);
    window.removeEventListener('mouseup', this.mu);
    window.removeEventListener('mousemove', this.mm);
    document.removeEventListener('pointerlockchange', this.plc);
  }

  requestLock() {
    if (!this.el || this.locked) return;
    try {
      const p = this.el.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* pointer lock not available */
    }
  }
  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  addPressListener(fn: Listener) {
    this.onPress.push(fn);
    return () => {
      this.onPress = this.onPress.filter((f) => f !== fn);
    };
  }

  private isTyping(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  private kd = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'F3') e.preventDefault();
    if (!e.repeat) {
      this.pressed.add(e.code);
      for (const fn of this.onPress) fn(e.code);
    }
    this.keys.add(e.code);
  };
  private ku = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private blur = () => {
    this.keys.clear();
  };
  private md = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) this.dragging = true;
  };
  private mu = () => {
    this.dragging = false;
  };
  private mm = (e: MouseEvent) => {
    if (this.locked || this.dragging) {
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    }
  };
  private wh = (e: WheelEvent) => {
    this.wheel += Math.sign(e.deltaY);
  };
  private plc = () => {
    const was = this.locked;
    this.locked = document.pointerLockElement === this.el;
    if (was && !this.locked) this.onUnlock?.();
  };

  down(code: string) {
    return this.enabled && this.keys.has(code);
  }
  /** true once per physical key press (consumed at end of frame) */
  hit(code: string) {
    return this.enabled && this.pressed.has(code);
  }
  axis(neg: string, pos: string) {
    return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0);
  }
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
