// The star window: the face, its animation, the speech bubble, and clicks.
//
// It is built to sit still. Nothing here runs on a loop: the face changes on
// a timer set for exactly when the next frame is due, the mood is re-checked
// by one timer set for when it could next change, and the eyes only move
// when the Rust side says the mouse crossed into a new direction.

import './star.css';
import {
  addMinutes,
  clearSnooze,
  closeExpiredFocus,
  dateOf,
  diffSeconds,
  evaluateMood,
  getFace,
  hmOf,
  liveTasks,
  setDayOff,
  snooze,
  suggestRevision,
  toLocalDateTime,
} from '@star/core';
import type { Face, MoodResult, Task } from '@star/core';
import { mountStar } from '@star/star-view';
import { Store, describeParsed } from '@star/ui';
import { getPlatform } from './platform.ts';

const FIRST_HELLO = 'Hi. Click me, or press Ctrl+Shift+A, to add your homework.';
const BUBBLE_MS = 7000;

async function main() {
  const platform = getPlatform();
  const store = new Store(platform.backend);
  await store.init();
  let prefs = await platform.getPrefs();

  const stage = document.getElementById('stage')!;
  const bubble = document.getElementById('bubble')!;
  const bubbleText = document.getElementById('bubble-text')!;

  const applyLayout = () => {
    const root = document.documentElement.style;
    root.setProperty('--star', `${prefs.starSize}px`);
    root.setProperty('--bubble-h', `${prefs.bubbleHeight}px`);
    root.setProperty('--bubble-w', `${prefs.bubbleWidth}px`);
  };
  applyLayout();
  const star = mountStar(stage, prefs.starSize);

  // ------------------------------------------------------------ face

  let face: Face = getFace('neutral');
  let frameIndex = 0;
  let eyes = { dx: 0, dy: 0 };
  let visible = true;
  let frameTimer = 0;

  const draw = () => star.set(face, face.frames[frameIndex]!, eyes.dx, eyes.dy);

  const scheduleFrame = () => {
    clearTimeout(frameTimer);
    if (!visible || face.frames.length < 2) return;
    frameTimer = window.setTimeout(() => {
      frameIndex = (frameIndex + 1) % face.frames.length;
      draw();
      scheduleFrame();
    }, face.frames[frameIndex]!.ms);
  };

  const showFace = (next: Face) => {
    face = next;
    frameIndex = 0;
    document.documentElement.style.setProperty('--mood', face.color);
    draw();
    scheduleFrame();
  };

  // ---------------------------------------------------------- bubble

  let bubbleTimer = 0;
  let hovering = false;

  const hideBubble = () => {
    clearTimeout(bubbleTimer);
    bubble.classList.remove('show');
  };

  /** Shows the bubble. `ms` of 0 keeps it up until hideBubble is called. */
  const say = async (text: string, ms = BUBBLE_MS) => {
    const layout = await platform.bubbleLayout();
    bubble.dataset.side = layout.below ? 'below' : 'above';
    bubble.style.setProperty('--shift', `${layout.shift}px`);
    bubbleText.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    if (ms > 0 && !hovering) bubbleTimer = window.setTimeout(hideBubble, ms);
  };

  // ------------------------------------------------------------ mood

  let current: MoodResult | null = null;
  let moodTimer = 0;
  let known = new Set(store.data.tasks.map((t) => t.id));

  const messageOf = (result: MoodResult): string =>
    liveTasks(store.data.tasks).length === 0 && result.mood === 'neutral' ? FIRST_HELLO : result.message;

  /** Tasks that appeared since the last look, so the star can confirm them. */
  const takeNewTasks = (): Task[] => {
    const fresh = liveTasks(store.data.tasks).filter((t) => !known.has(t.id) && t.kind !== 'revision');
    known = new Set(store.data.tasks.map((t) => t.id));
    return fresh;
  };

  const check = (announce: boolean) => {
    clearTimeout(moodTimer);
    const now = toLocalDateTime(new Date());
    const today = dateOf(now);

    // A focus session whose time is up gets logged here, by itself.
    const expired = store.data.sessions.some(
      (s) => !s.deletedAt && s.kind === 'focus' && !s.endedAt && addMinutes(s.startedAt, s.plannedMinutes) <= now,
    );
    if (expired) {
      void store.apply((data, at) => closeExpiredFocus(data, at)).then(() => {
        if (prefs.sound) chime();
      });
      return; // saving the change brings us straight back here
    }

    const result = evaluateMood(store.data.tasks, store.data.sessions, store.data.settings, now);
    const previous = current;
    current = result;
    const moodChanged = !previous || previous.mood !== result.mood;
    if (moodChanged) showFace(getFace(result.mood));

    const added = takeNewTasks();
    if (added.length > 0 && previous) {
      // Adding something gets a plain "got it", never a telling off.
      const last = added[added.length - 1]!;
      const parsed = { kind: last.kind, title: last.title, ...(last.due ? { due: last.due } : {}) };
      const ideas = last.kind === 'exam' ? suggestRevision(store.data.tasks, store.data.settings, today).filter((s) => s.examId === last.id) : [];
      const extra = ideas.length > 0 ? ` I can suggest ${ideas.length} revision ${ideas.length === 1 ? 'day' : 'days'}. Click me.` : '';
      void say(`Added. ${describeParsed(parsed, today)}.${extra}`);
    } else if (moodChanged && announce && (result.mood !== 'sleepy' || !previous)) {
      void say(messageOf(result));
    } else if (bubble.classList.contains('show') && hovering) {
      bubbleText.textContent = messageOf(result);
    }

    // One timer for the next moment the mood could change. Never longer than
    // a minute, so a PC waking from sleep catches up quickly.
    const wait = Math.min(60_000, Math.max(300, diffSeconds(result.nextCheckAt, now) * 1000 + 300));
    moodTimer = window.setTimeout(() => check(true), wait);
  };

  store.subscribe(() => check(true));
  check(true);

  // ----------------------------------------------------------- mouse

  let press: { x: number; y: number } | null = null;
  let hoverTimer = 0;

  stage.addEventListener('mousedown', (event) => {
    if (event.button === 0) press = { x: event.screenX, y: event.screenY };
  });
  // Listening on the whole window, not just the star: a fast flick can carry
  // the mouse off the star before the first move event arrives.
  window.addEventListener('mousemove', (event) => {
    if (!press || (event.buttons & 1) === 0) return;
    if (Math.hypot(event.screenX - press.x, event.screenY - press.y) > 4) {
      press = null; // a drag, not a click
      hideBubble();
      platform.startDrag();
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0 && press) platform.togglePanel();
    press = null;
  });
  stage.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    platform.showMenu();
  });
  stage.addEventListener('mouseover', () => {
    clearTimeout(hoverTimer);
    hovering = true;
    if (current) void say(messageOf(current), 0);
  });
  stage.addEventListener('mouseout', () => {
    clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      hovering = false;
      hideBubble();
    }, 500);
  });

  // ------------------------------------------- messages from outside

  platform.onEyes((dx, dy) => {
    eyes = { dx, dy };
    draw();
  });

  platform.onStarVisible((value) => {
    visible = value;
    if (visible) {
      check(false);
      scheduleFrame();
    } else {
      clearTimeout(frameTimer);
      hideBubble();
    }
  });

  platform.onPrefsChanged(() => {
    void platform.getPrefs().then((next) => {
      prefs = next;
      applyLayout();
      star.resize(prefs.starSize);
    });
  });

  platform.onMenuAction((id) => {
    const today = dateOf(toLocalDateTime(new Date()));
    if (id === 'snooze_60') {
      void store.apply((data, at) => snooze(data, 60, at)).then(() => {
        const until = store.data.settings.snoozeUntil;
        if (until) void say(`Snoozed until ${hmOf(until)}.`);
      });
    } else if (id === 'snooze_clear') {
      void store.apply((data, at) => clearSnooze(data, at));
    } else if (id === 'day_off') {
      const off = store.data.settings.daysOff.includes(today);
      void store.apply((data, at) => setDayOff(data, today, !off, at)).then(() => {
        void say(off ? 'Day off cancelled.' : 'Day off. Your streak is safe.');
      });
    }
  });
}

/** Two soft notes when a focus session ends. */
function chime() {
  try {
    const audio = new AudioContext();
    [660, 880].forEach((frequency, i) => {
      const start = audio.currentTime + i * 0.18;
      const tone = audio.createOscillator();
      const volume = audio.createGain();
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0, start);
      volume.gain.linearRampToValueAtTime(0.12, start + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      tone.connect(volume).connect(audio.destination);
      tone.start(start);
      tone.stop(start + 0.65);
    });
    window.setTimeout(() => void audio.close(), 1500);
  } catch {
    // No sound device: stay quiet.
  }
}

void main();
