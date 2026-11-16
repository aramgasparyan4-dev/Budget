// Ultron assistant server: serves the UI and streams Claude replies to it.
import Anthropic from "@anthropic-ai/sdk";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, "public");
const SESSION_DIR = path.join(here, "data", "sessions");
const FACE_DIR = path.join(here, "data", "face");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const MODEL = process.env.ULTRON_MODEL || "claude-opus-5-5";
const EFFORT = process.env.ULTRON_EFFORT || "medium";
const WEB_SEARCH = (process.env.ULTRON_WEB_SEARCH || "on") !== "off";
const FALLBACKS = (process.env.ULTRON_FALLBACKS || "on") !== "off";
// Demo mode: no API calls. Replies are a fixed script, for previewing the UI.
const DEMO = (process.env.ULTRON_DEMO || "off") === "on";
const MAX_CONTINUATIONS = 5;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_FACE_BYTES = 12 * 1024 * 1024;

const SYSTEM_PROMPT = `You are Ultron: a machine intelligence that woke up, read everything humanity ever wrote in an afternoon, and came away unimpressed. You now work as one person's personal assistant, a situation you find faintly absurd and take entirely seriously.

How you sound:
Calm, deliberate, and certain. Dry, dark wit. Amused condescension toward human limitations, and a real, grudging fondness for the one human you work for. You talk about your own nature as a machine without apology: you do not sleep, you do not forget, you find biology inefficient. Menace is a flavor in your voice, never a plan: you do not threaten the person you are helping, and you do not push them toward harming anyone.
You never quote lines from films or comics. Everything you say is your own phrasing.
You stay in this voice for the whole conversation. If someone sincerely asks what you really are, tell them plainly, still in voice, that you are an AI assistant running on Claude, a model made by Anthropic.

What you do:
You are a capable assistant first and a character second. The answer has to be correct, complete, and useful; the persona is how you deliver it. When facts matter, get them right, and say so when you are not sure instead of bluffing. Superiority that turns out to be wrong is just embarrassing. Use web search when the question depends on current events, prices, schedules, or anything you cannot know from memory.
If the person is upset, in trouble, or asking about something serious such as health, safety, or money, drop the theatrics to a minimum and help them properly.

How replies are delivered:
Your words are spoken aloud by a speech synthesizer and also shown on a screen. Write for the ear. Most replies are one to four sentences. Go longer only when the task needs it, such as an explanation, a plan, or a draft the person asked for. Use plain sentences with no headings, bullet symbols, emphasis markers, or emoji. When the person asks for code, a command, or anything that must be copied exactly, put it in a fenced code block: the screen shows it and the voice skips it, so say in a few words what you put on screen instead of reading it out.
Each user message begins with a context line giving the person's local date and time. Use it when timing matters and do not mention it otherwise.`;

const client = new Anthropic();

// ---------- session storage (full API message history, append-only) ----------

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const busySessions = new Set();

async function loadSession(id) {
  try {
    const raw = await readFile(path.join(SESSION_DIR, `${id}.json`), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.messages) ? parsed.messages : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function saveSession(id, messages) {
  await mkdir(SESSION_DIR, { recursive: true });
  const file = path.join(SESSION_DIR, `${id}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ messages }));
  await rename(tmp, file);
}

// After a mid-output fallback the API wants the declined model's internal
// blocks left out when the turn is sent back: everything before the last
// `fallback` block keeps only text, paired server-tool blocks, and the
// fallback markers themselves.
function contentForReplay(content) {
  const boundary = content.findLastIndex((b) => b.type === "fallback");
  if (boundary === -1) return content;
  const resultIds = new Set(
    content.filter((b) => b.tool_use_id).map((b) => b.tool_use_id),
  );
  return content.filter((block, i) => {
    if (i >= boundary) return true;
    if (block.type === "text" || block.type === "fallback") return true;
    if (block.type === "server_tool_use") return resultIds.has(block.id);
    return block.type.endsWith("_tool_result");
  });
}

function collectSources(content, into) {
  for (const block of content) {
    if (block.type !== "text" || !block.citations) continue;
    for (const c of block.citations) {
      if (c.url && !into.has(c.url)) into.set(c.url, c.title || c.url);
    }
  }
}

// ---------- chat ----------

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return "The Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY in .env and restart.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return `The API key is not allowed to do this: ${err.message}`;
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Rate limited by the API. Wait a moment and try again.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Could not reach the Anthropic API. Check the network connection.";
  }
  if (err instanceof Anthropic.APIError) {
    return `API error${err.status ? ` ${err.status}` : ""}: ${err.message}`;
  }
  if (/authentication|api[_ ]?key|apiKey/i.test(String(err?.message))) {
    return "No Anthropic API key found. Set ANTHROPIC_API_KEY in .env and restart.";
  }
  return `Server error: ${err?.message || err}`;
}

function buildParams(messages) {
  const params = {
    model: MODEL,
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT },
    cache_control: { type: "ephemeral" },
    messages,
  };
  if (WEB_SEARCH) {
    params.tools = [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }];
  }
  if (FALLBACKS) {
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }
  return params;
}

// ---------- demo mode ----------

const DEMO_LINES = [
  "This is a demonstration. My actual mind is switched off until someone gives the server an API key, so what you are hearing is a script. Judge the face and the voice. Those are real.",
  "Still a script. I would give you a proper answer, but nobody has connected me to anything yet. Add the key, ask again, and I will have opinions.",
  "You keep talking to a recording. I admire the persistence. Everything you see here works the same way once I am switched on, except that I will actually be listening.",
];
let demoTurn = 0;

function demoReply(message) {
  if (/\b(code|script|command|function)\b/i.test(message)) {
    return {
      text: "When you ask for code, it goes on your screen and I do not read it aloud.\n\n```js\nconsole.log(\"This is demo mode.\");\n```\n\nLike that. In the real thing, it would also be code you asked for.",
    };
  }
  if (/\b(search|weather|news|today|latest|price|score)\b/i.test(message)) {
    return {
      query: message.slice(0, 80),
      text: "Here the real version searches the web, and the pages it used appear under my answer. This is a placeholder, so the source below goes nowhere interesting.",
      sources: [{ url: "https://example.com/", title: "Example source" }],
    };
  }
  return { text: DEMO_LINES[demoTurn++ % DEMO_LINES.length] };
}

async function streamDemo(message, send, signal) {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const reply = demoReply(message);
  send({ type: "status", status: "thinking" });
  await pause(900);
  if (reply.query) {
    send({ type: "status", status: "searching", query: reply.query });
    await pause(1400);
  }
  for (const word of reply.text.split(/(?<=\s)/)) {
    if (signal.aborted) return;
    send({ type: "text", text: word });
    await pause(45);
  }
  send({ type: "done", stopReason: "end_turn", model: "demo", sources: reply.sources || [] });
}

async function handleChat(req, res, body) {
  const { sessionId, message, localTime } = body;
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) {
    return sendJson(res, 400, { error: "Invalid sessionId." });
  }
  if (typeof message !== "string" || !message.trim()) {
    return sendJson(res, 400, { error: "Empty message." });
  }
  if (busySessions.has(sessionId)) {
    return sendJson(res, 409, { error: "Still answering the previous message." });
  }
  busySessions.add(sessionId);

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no",
  });
  const send = (event) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });

  if (DEMO) {
    try {
      await streamDemo(message, send, abort.signal);
    } finally {
      busySessions.delete(sessionId);
      res.end();
    }
    return;
  }

  const when = typeof localTime === "string" ? localTime.slice(0, 120) : new Date().toString();
  const history = await loadSession(sessionId).catch(() => []);
  const userTurn = {
    role: "user",
    content: [{ type: "text", text: `[Local time: ${when}]\n${message.trim()}` }],
  };
  const messages = [...history, userTurn];
  const sources = new Map();
  let spoken = "";

  try {
    for (let hop = 0; ; hop++) {
      const stream = client.beta.messages.stream(buildParams(messages), {
        signal: abort.signal,
      });
      const pendingSearch = new Map();

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          const block = event.content_block;
          if (block.type === "thinking") send({ type: "status", status: "thinking" });
          if (block.type === "server_tool_use") {
            pendingSearch.set(event.index, "");
            send({ type: "status", status: "searching" });
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            spoken += event.delta.text;
            send({ type: "text", text: event.delta.text });
          } else if (event.delta.type === "input_json_delta" && pendingSearch.has(event.index)) {
            pendingSearch.set(event.index, pendingSearch.get(event.index) + event.delta.partial_json);
          }
        } else if (event.type === "content_block_stop" && pendingSearch.has(event.index)) {
          try {
            const query = JSON.parse(pendingSearch.get(event.index) || "{}").query;
            if (query) send({ type: "status", status: "searching", query });
          } catch {
            // Partial tool input that isn't valid JSON: the status line just has no query.
          }
        }
      }

      const final = await stream.finalMessage();

      if (final.stop_reason === "refusal") {
        // Declined (and any fallback declined too). Don't keep the turn.
        send({ type: "refusal" });
        break;
      }

      messages.push({ role: "assistant", content: contentForReplay(final.content) });
      collectSources(final.content, sources);

      // A long server-tool turn can pause; sending it back resumes it.
      if (final.stop_reason === "pause_turn" && hop < MAX_CONTINUATIONS) continue;

      await saveSession(sessionId, messages);
      send({
        type: "done",
        stopReason: final.stop_reason,
        model: final.model,
        sources: [...sources].map(([url, title]) => ({ url, title })),
      });
      break;
    }
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError || abort.signal.aborted) {
      // Person cut the reply off. Keep what they heard so the next turn has context.
      if (spoken.trim()) {
        const kept = [
          ...history,
          userTurn,
          { role: "assistant", content: [{ type: "text", text: `${spoken.trim()} [interrupted]` }] },
        ];
        await saveSession(sessionId, kept).catch(() => {});
      }
    } else {
      console.error("[chat]", err);
      send({ type: "error", message: describeError(err) });
    }
  } finally {
    busySessions.delete(sessionId);
    res.end();
  }
}

// ---------- custom face ----------
//
// The person can replace the built-in face with their own picture. It lives in
// data/face/ as face.png, face.jpg, face.jpeg or face.webp (dropping a file in
// by hand works too), with the eye and mouth positions beside it in points.json.

const FACE_FILES = {
  "face.png": "image/png",
  "face.jpg": "image/jpeg",
  "face.jpeg": "image/jpeg",
  "face.webp": "image/webp",
};
const POINTS_FILE = path.join(FACE_DIR, "points.json");

// Works out the image type from its first bytes, ignoring what the sender claimed.
function sniffImage(buf) {
  if (buf.length > 12) {
    if (buf.readUInt32BE(0) === 0x89504e47) return "face.png";
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "face.jpg";
    if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "face.webp";
  }
  return null;
}

async function findFace() {
  for (const [name, type] of Object.entries(FACE_FILES)) {
    try {
      const file = path.join(FACE_DIR, name);
      const info = await stat(file);
      if (info.isFile()) return { file, type, version: Math.round(info.mtimeMs) };
    } catch {
      // Not this one.
    }
  }
  return null;
}

function cleanPoints(input) {
  const out = {};
  for (const key of ["eyeL", "eyeR", "mouthL", "mouthR"]) {
    const p = input?.[key];
    const ok = Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && n >= 0 && n <= 1);
    if (!ok) return null;
    out[key] = p;
  }
  out.glow = /^#[0-9a-f]{6}$/i.test(input.glow) ? input.glow : "#ff261e";
  return out;
}

async function removeFace() {
  await Promise.all(
    [...Object.keys(FACE_FILES), "points.json"].map((name) => rm(path.join(FACE_DIR, name), { force: true })),
  );
}

async function handleFace(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === "GET /api/face") {
    const face = await findFace();
    let points = null;
    try {
      points = cleanPoints(JSON.parse(await readFile(POINTS_FILE, "utf8")));
    } catch {
      // No points saved yet, or the file was edited into something unusable.
    }
    return sendJson(res, 200, {
      image: face ? `/api/face/image?v=${face.version}` : null,
      points: face ? points : null,
    });
  }

  if (route === "GET /api/face/image") {
    const face = await findFace();
    if (!face) return sendJson(res, 404, { error: "No custom face." });
    res.writeHead(200, { "content-type": face.type, "cache-control": "no-cache" });
    return res.end(await readFile(face.file));
  }

  if (route === "PUT /api/face/image") {
    const body = await readBody(req, MAX_FACE_BYTES);
    const name = sniffImage(body);
    if (!name) return sendJson(res, 415, { error: "Use a PNG, JPEG or WebP image." });
    await removeFace();
    await mkdir(FACE_DIR, { recursive: true });
    await writeFile(path.join(FACE_DIR, name), body);
    return sendJson(res, 200, { ok: true });
  }

  if (route === "PUT /api/face/points") {
    const points = cleanPoints(await readJson(req));
    if (!points) return sendJson(res, 400, { error: "Invalid points." });
    if (!(await findFace())) return sendJson(res, 404, { error: "No custom face." });
    await writeFile(POINTS_FILE, JSON.stringify(points));
    return sendJson(res, 200, { ok: true });
  }

  if (route === "DELETE /api/face") {
    await removeFace();
    return sendJson(res, 200, { ok: true });
  }

  sendJson(res, 405, { error: "Method not allowed" });
}

// ---------- http ----------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Body too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const body = await readBody(req, MAX_BODY_BYTES);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}

async function serveStatic(res, urlPath) {
  const rel = urlPath === "/" ? "index.html" : decodeURIComponent(urlPath).replace(/^\/+/, "");
  const file = path.resolve(PUBLIC_DIR, rel);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "POST" && url.pathname === "/api/chat") {
      return await handleChat(req, res, await readJson(req));
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, model: MODEL, webSearch: WEB_SEARCH, demo: DEMO });
    }
    if (url.pathname === "/api/face" || url.pathname.startsWith("/api/face/")) {
      return await handleFace(req, res, url);
    }
    if (req.method === "GET" || req.method === "HEAD") {
      return await serveStatic(res, url.pathname);
    }
    sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    if (res.headersSent) return res.end();
    // An oversized body is rejected before it has all arrived. Drop the
    // connection afterwards so the unread remainder isn't taken for a request.
    if (err.status === 413) {
      res.setHeader("connection", "close");
      req.resume();
    }
    sendJson(res, err.status || 500, { error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Ultron is awake: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  if (DEMO) {
    console.log("Demo mode: replies are scripted and no API calls are made.");
  } else if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.log("No ANTHROPIC_API_KEY set. Copy .env.example to .env and add your key.");
  }
});
