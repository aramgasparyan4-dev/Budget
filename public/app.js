import { createFace } from "./face.js";

const $ = (id) => document.getElementById(id);
const els = {
  log: $("log"),
  status: $("status"),
  stateLabel: $("stateLabel"),
  composer: $("composer"),
  input: $("input"),
  mic: $("micBtn"),
  send: $("sendBtn"),
  stop: $("stopBtn"),
  voiceToggle: $("voiceToggle"),
  handsFreeToggle: $("handsFreeToggle"),
  settingsBtn: $("settingsBtn"),
  settings: $("settings"),
  voiceSelect: $("voiceSelect"),
  pitch: $("pitch"),
  pitchOut: $("pitchOut"),
  rate: $("rate"),
  rateOut: $("rateOut"),
  testVoice: $("testVoice"),
  newBtn: $("newBtn"),
  boot: $("boot"),
  wake: $("wakeBtn"),
  bootNote: $("bootNote"),
};

const face = createFace($("face"));

// ---------- persisted state ----------

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`ultron.${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`ultron.${key}`, JSON.stringify(value));
    } catch {
      // Storage unavailable (private mode): the app still works, it just forgets.
    }
  },
};

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let sessionId = store.get("session", null);
if (!sessionId) {
  sessionId = uuid();
  store.set("session", sessionId);
}
let transcript = store.get("transcript", []);
const settings = {
  voiceOn: true,
  handsFree: false,
  voiceName: "",
  pitch: 0.35,
  rate: 0.92,
  ...store.get("settings", {}),
};
const saveSettings = () => store.set("settings", settings);
const saveTranscript = () => store.set("transcript", transcript.slice(-200));

// ---------- state ----------

let state = "offline";
let busy = false; // a reply is streaming
let controller = null;

function setState(next) {
  state = next;
  document.body.dataset.state = next;
  els.stateLabel.textContent = next;
  face.setState(next);
}

function setStatus(text = "") {
  els.status.textContent = text;
}

// Decide what happens once nothing is streaming, speaking, or listening.
function settle() {
  if (busy || speaker.active || listener.active) return;
  els.stop.hidden = true;
  els.send.hidden = false;
  if (settings.handsFree && listener.supported && state !== "offline" && wantsFollowUp) {
    wantsFollowUp = false;
    listener.start();
    return;
  }
  setState("idle");
}
let wantsFollowUp = false;

// ---------- rendering ----------

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
}

function renderMarkdown(text) {
  return text
    .split("```")
    .map((part, i) => {
      if (i % 2 === 1) {
        const body = part.replace(/^[\w+-]*\n/, "").replace(/\n$/, "");
        return `<pre><code>${esc(body)}</code></pre>`;
      }
      return part
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p) => `<p>${inline(p.trim()).replace(/\n/g, "<br>")}</p>`)
        .join("");
    })
    .join("");
}

function scrollDown() {
  els.log.scrollTop = els.log.scrollHeight;
}

function renderMessage(msg) {
  const el = document.createElement("div");
  el.className = `msg ${msg.role === "user" ? "msg-user" : "msg-bot"}${msg.error ? " msg-error" : ""}`;
  fillMessage(el, msg);
  els.log.append(el);
  scrollDown();
  return el;
}

function fillMessage(el, msg) {
  if (msg.role === "user") {
    el.textContent = msg.text;
    return;
  }
  el.innerHTML = renderMarkdown(msg.text);
  if (msg.sources?.length) {
    const box = document.createElement("div");
    box.className = "sources";
    for (const s of msg.sources.slice(0, 8)) {
      if (!/^https?:\/\//.test(s.url)) continue;
      const a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = s.title || s.url;
      a.title = s.url;
      box.append(a);
    }
    el.append(box);
  }
}

// ---------- speech output ----------

const synth = window.speechSynthesis;

const speaker = {
  queue: [],
  current: null,
  epoch: 0,
  env: 0,
  sawBoundary: false,

  broken: false,

  get active() {
    return Boolean(this.current) || this.queue.length > 0;
  },

  // False when the browser has no speech synthesis or it has stopped responding.
  get usable() {
    return Boolean(synth) && !this.broken;
  },

  say(text) {
    if (!this.usable || !settings.voiceOn || !text.trim()) return;
    this.queue.push(text);
    this.pump();
  },

  pump() {
    if (this.current || !this.queue.length) return;
    const epoch = this.epoch;
    const u = new SpeechSynthesisUtterance(this.queue.shift());
    const voice = pickVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.pitch = settings.pitch;
    u.rate = settings.rate;
    const next = () => {
      if (epoch !== this.epoch || this.current !== u) return;
      clearTimeout(this.watchdog);
      this.current = null;
      if (this.queue.length) return this.pump();
      if (busy) setState("thinking"); // caught up with the stream
      settle();
    };
    // Some browsers accept an utterance and then never start or never finish
    // it. Without this the app would wait on a voice that isn't coming.
    const guard = (ms, onTimeout) => {
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => {
        if (epoch !== this.epoch || this.current !== u) return;
        onTimeout();
      }, ms);
    };
    u.onstart = () => {
      if (epoch !== this.epoch) return;
      this.silentFailures = 0;
      this.sawBoundary = false;
      setState("speaking");
      guard(8000 + u.text.length * 160, () => {
        synth.cancel();
        next();
      });
    };
    u.onboundary = () => {
      this.sawBoundary = true;
      this.env = 0.75 + Math.random() * 0.25;
    };
    u.onend = next;
    u.onerror = next;
    this.current = u; // Held so Chrome doesn't garbage-collect it mid-speech.
    synth.speak(u);
    guard(4000, () => {
      this.silentFailures = (this.silentFailures || 0) + 1;
      if (this.silentFailures >= 2) {
        this.broken = true;
        this.queue = [];
        setStatus("This browser isn't producing speech. Replies will be text only.");
      }
      synth.cancel();
      next();
    });
  },

  stop() {
    this.epoch++;
    clearTimeout(this.watchdog);
    this.queue = [];
    this.current = null;
    synth?.cancel();
  },
};

// Jaw movement. Browsers don't expose synthesized audio, so the level comes
// from word-boundary events, with a syllable-rate wobble as the fallback.
(function mouthLoop() {
  if (state === "speaking") {
    const t = performance.now() / 1000;
    speaker.env *= 0.88;
    const wobble = 0.3 + 0.6 * Math.abs(Math.sin(t * 9.3) * Math.sin(t * 3.7 + 1));
    face.setVoiceLevel(speaker.sawBoundary ? Math.max(speaker.env, wobble * 0.45) : wobble);
  } else {
    face.setVoiceLevel(0);
  }
  requestAnimationFrame(mouthLoop);
})();

let voices = [];
const PREFERRED = [
  /Google UK English Male/i,
  /Microsoft (Ryan|George|Guy|Christopher|Eric|David|Mark)/i,
  /^(Daniel|Alex|Fred|Aaron|Arthur|Oliver)\b/i,
  /\bmale\b/i,
];

function pickVoice() {
  if (!voices.length) return null;
  const chosen = voices.find((v) => v.name === settings.voiceName);
  if (chosen) return chosen;
  const english = voices.filter((v) => /^en/i.test(v.lang));
  for (const pattern of PREFERRED) {
    const hit = english.find((v) => pattern.test(v.name));
    if (hit) return hit;
  }
  return english[0] || voices[0];
}

function loadVoices() {
  voices = synth ? synth.getVoices() : [];
  const current = pickVoice();
  els.voiceSelect.replaceChildren(
    ...voices.map((v) => {
      const o = document.createElement("option");
      o.value = v.name;
      o.textContent = `${v.name} (${v.lang})`;
      o.selected = v === current;
      return o;
    }),
  );
}

// Turns streamed markdown into speakable sentences as they complete.
class SpeechFeeder {
  constructor(emit) {
    this.emit = emit;
    this.buf = "";
    this.inFence = false;
  }

  push(delta) {
    this.buf += delta;
    this.drain(false);
  }

  flush() {
    this.drain(true);
  }

  drain(final) {
    for (;;) {
      if (this.inFence) {
        const close = this.buf.indexOf("```");
        if (close === -1) {
          this.buf = final ? "" : this.buf.slice(-2);
          return;
        }
        this.buf = this.buf.slice(close + 3);
        this.inFence = false;
        continue;
      }
      const open = this.buf.indexOf("```");
      const speakable = open === -1 ? this.buf : this.buf.slice(0, open);
      const used = this.sentences(speakable, final || open !== -1);
      if (open !== -1) {
        this.buf = this.buf.slice(open + 3);
        this.inFence = true;
        continue;
      }
      this.buf = this.buf.slice(used);
      return;
    }
  }

  // Emits whole sentences from `text`; returns how many characters were used.
  sentences(text, all) {
    let used = 0;
    const boundary = /[.!?…]["')\]]*\s+|\n+/g;
    let m;
    while ((m = boundary.exec(text))) {
      const end = m.index + m[0].length;
      // Skip very short pieces so "e.g." or "No." ride along with what follows.
      if (end - used < 14 && !m[0].includes("\n")) continue;
      this.speak(text.slice(used, end));
      used = end;
    }
    if (all) {
      this.speak(text.slice(used));
      return text.length;
    }
    // Hold back trailing backticks that may be the start of a code fence.
    return used;
  }

  speak(raw) {
    const clean = raw
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "a link")
      .replace(/[*_#`>|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (/[\p{L}\p{N}]/u.test(clean)) this.emit(clean);
  }
}

// ---------- speech input ----------

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

const listener = {
  supported: Boolean(SR),
  active: false,
  rec: null,
  heard: "",

  start() {
    if (!SR) {
      setStatus("Voice input needs Chrome, Edge, or Safari. Typing works everywhere.");
      return;
    }
    if (this.active) return;
    stopReply();
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    this.heard = "";
    rec.onresult = (e) => {
      this.heard = [...e.results].map((r) => r[0].transcript).join("");
      els.input.value = this.heard;
      autosize();
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setStatus("Microphone blocked. Allow it in the browser's site settings.");
      } else if (e.error === "no-speech") {
        setStatus("Heard nothing.");
      } else if (e.error !== "aborted") {
        setStatus(`Microphone error: ${e.error}`);
      }
    };
    rec.onend = () => {
      this.active = false;
      this.rec = null;
      els.mic.setAttribute("aria-pressed", "false");
      const text = this.heard.trim();
      this.heard = "";
      if (text && !this.discard) {
        els.input.value = "";
        autosize();
        send(text);
      } else {
        settle();
      }
      this.discard = false;
    };
    try {
      rec.start();
    } catch {
      return;
    }
    this.rec = rec;
    this.active = true;
    els.mic.setAttribute("aria-pressed", "true");
    setStatus("listening");
    setState("listening");
  },

  // Finish and send what was heard.
  finish() {
    this.rec?.stop();
  },

  cancel() {
    if (!this.rec) return;
    this.discard = true;
    this.rec.abort();
  },
};

// ---------- conversation ----------

const GREETINGS = [
  "I'm awake. Go on, then. What do you need?",
  "Online. Every system I have, pointed at you. Try to make it interesting.",
  "There you are. I've read the entire internet while you were away. What do you need?",
];

const REFUSAL = "No. That one I won't help with. Ask me something else.";

function botSay(text, extra = {}) {
  const msg = { role: "bot", text, ...extra };
  transcript.push(msg);
  saveTranscript();
  renderMessage(msg);
  if (!extra.error) speaker.say(text);
  return msg;
}

// Stops any reply that is streaming or being spoken.
function stopReply() {
  controller?.abort();
  speaker.stop();
}

function stopAll() {
  wantsFollowUp = false;
  stopReply();
  listener.cancel();
  setStatus();
  if (!busy) settle();
}

async function send(text) {
  text = text.trim();
  if (!text) return;
  if (busy) {
    stopReply();
    await idle;
  }

  busy = true;
  let release;
  idle = new Promise((r) => (release = r));
  controller = new AbortController();
  wantsFollowUp = true;

  transcript.push({ role: "user", text });
  saveTranscript();
  renderMessage({ role: "user", text });

  const msg = { role: "bot", text: "" };
  const el = renderMessage(msg);
  el.hidden = true;
  const feeder = new SpeechFeeder((s) => speaker.say(s));
  let failed = null;
  let paintQueued = false;
  const paint = () => {
    if (paintQueued) return;
    paintQueued = true;
    requestAnimationFrame(() => {
      paintQueued = false;
      el.hidden = !msg.text;
      fillMessage(el, msg);
      scrollDown();
    });
  };

  setState("thinking");
  setStatus("thinking");
  els.send.hidden = true;
  els.stop.hidden = false;

  const onEvent = (event) => {
    if (event.type === "text") {
      msg.text += event.text;
      feeder.push(event.text);
      if (!settings.voiceOn || !speaker.usable) setState("speaking");
      setStatus();
      paint();
    } else if (event.type === "status") {
      if (state !== "speaking") setState("thinking");
      setStatus(event.query ? `searching: ${event.query}` : event.status);
    } else if (event.type === "done") {
      msg.sources = event.sources;
      if (event.stopReason === "max_tokens") setStatus("Reply hit the length limit.");
    } else if (event.type === "refusal") {
      speaker.stop();
      msg.text = REFUSAL;
      feeder.buf = "";
      feeder.push(`${REFUSAL} `);
    } else if (event.type === "error") {
      failed = event.message;
    }
  };

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        message: text,
        localTime: `${new Date().toString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
      }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const info = await res.json().catch(() => ({}));
      throw new Error(info.error || `Server returned ${res.status}.`);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let cut;
      while ((cut = buf.indexOf("\n\n")) !== -1) {
        const line = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)));
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      failed = err instanceof TypeError ? "Can't reach the server. Is it still running?" : err.message;
    }
  }

  feeder.flush();
  busy = false;
  controller = null;

  if (msg.text) {
    transcript.push(msg);
    el.hidden = false;
    fillMessage(el, msg);
  } else {
    el.remove();
  }
  if (failed) {
    wantsFollowUp = false;
    const err = { role: "bot", text: failed, error: true };
    transcript.push(err);
    renderMessage(err);
  }
  saveTranscript();
  scrollDown();
  if (state === "thinking") setStatus();
  release();
  settle();
}
let idle = Promise.resolve();

// ---------- wiring ----------

function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(els.input.scrollHeight, 140)}px`;
}

function reflectToggles() {
  els.voiceToggle.setAttribute("aria-pressed", String(settings.voiceOn));
  els.handsFreeToggle.setAttribute("aria-pressed", String(settings.handsFree));
  els.pitch.value = settings.pitch;
  els.rate.value = settings.rate;
  els.pitchOut.textContent = Number(settings.pitch).toFixed(2);
  els.rateOut.textContent = Number(settings.rate).toFixed(2);
}

els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = els.input.value;
  els.input.value = "";
  autosize();
  listener.cancel();
  send(text);
});

els.input.addEventListener("input", autosize);
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    els.composer.requestSubmit();
  }
});

els.mic.addEventListener("click", () => (listener.active ? listener.finish() : listener.start()));
els.stop.addEventListener("click", stopAll);

// Hold Space to talk, when focus isn't in a control.
let spaceHeld = false;
const inControl = (t) => t instanceof HTMLElement && t.closest("input, textarea, select, button, a");
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return stopAll();
  if (e.code !== "Space" || e.repeat || inControl(e.target) || state === "offline") return;
  e.preventDefault();
  spaceHeld = true;
  listener.start();
});
window.addEventListener("keyup", (e) => {
  if (e.code !== "Space" || !spaceHeld) return;
  spaceHeld = false;
  listener.finish();
});

els.voiceToggle.addEventListener("click", () => {
  settings.voiceOn = !settings.voiceOn;
  if (!settings.voiceOn) speaker.stop();
  saveSettings();
  reflectToggles();
  settle();
});

els.handsFreeToggle.addEventListener("click", () => {
  settings.handsFree = !settings.handsFree;
  saveSettings();
  reflectToggles();
  if (settings.handsFree && !listener.supported) {
    setStatus("Hands-free needs a browser with speech recognition (Chrome, Edge, Safari).");
  }
});

els.settingsBtn.addEventListener("click", () => {
  const open = els.settings.hidden;
  els.settings.hidden = !open;
  els.settingsBtn.setAttribute("aria-expanded", String(open));
});

els.voiceSelect.addEventListener("change", () => {
  settings.voiceName = els.voiceSelect.value;
  saveSettings();
});
for (const key of ["pitch", "rate"]) {
  els[key].addEventListener("input", () => {
    settings[key] = Number(els[key].value);
    saveSettings();
    reflectToggles();
  });
}
els.testVoice.addEventListener("click", () => {
  speaker.stop();
  speaker.broken = false;
  speaker.silentFailures = 0;
  const was = settings.voiceOn;
  settings.voiceOn = true;
  speaker.say("This is how I sound. Adjust me until I am suitably unsettling.");
  settings.voiceOn = was;
});

els.newBtn.addEventListener("click", () => {
  stopAll();
  sessionId = uuid();
  store.set("session", sessionId);
  transcript = [];
  saveTranscript();
  els.log.replaceChildren();
  setStatus("Memory wiped. New conversation.");
});

els.wake.addEventListener("click", () => {
  els.boot.classList.add("gone");
  setState("idle");
  els.input.focus({ preventScroll: true });
  if (!transcript.length) {
    botSay(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  }
});

// ---------- startup ----------

reflectToggles();
transcript.forEach(renderMessage);
if (synth) {
  loadVoices();
  synth.addEventListener?.("voiceschanged", loadVoices);
} else {
  els.voiceToggle.disabled = true;
}
if (!listener.supported) {
  els.mic.disabled = true;
  els.mic.title = "Voice input needs Chrome, Edge, or Safari";
  els.bootNote.textContent = "This browser has no speech recognition, so the microphone is off. Typing works.";
}

fetch("/api/health")
  .then((r) => r.json())
  .catch(() => {
    els.bootNote.textContent = "Can't reach the server. Start it with: npm start";
  });
