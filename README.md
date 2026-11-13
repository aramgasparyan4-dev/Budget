# Ultron

A voice assistant with an Ultron persona. You talk (or type), it answers out loud in character, and an animated machine face reacts while it listens, thinks, and speaks. The answers come from Claude, with live web search when a question needs current information.

## Run it

Needs Node 20.6 or newer and an Anthropic API key.

```bash
npm install
cp .env.example .env      # then put your key in ANTHROPIC_API_KEY
npm start
```

Open http://localhost:3000 and press **Wake**. Use Chrome or Edge for the full experience: they have both speech recognition and good voices. Safari works too. Firefox has no speech recognition, so there you type and it still talks.

## Using it

| Action | How |
| --- | --- |
| Talk | Click the mic, or hold Space. It sends when you stop talking. |
| Type | Enter sends, Shift+Enter adds a line. |
| Interrupt | Esc, the stop button, or just start talking. |
| Hands-free | Listens again by itself after each reply. |
| Tune | Pick the voice and adjust pitch and speed. Low pitch and a male English voice sound best. |
| New | Wipes the conversation and starts over. |

Code and commands show on screen and are not read aloud.

## Settings

Set these in `.env`:

| Variable | Default | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | none | Required. |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Where the server listens. |
| `ULTRON_MODEL` | `claude-opus-5-5` | Which Claude model answers. |
| `ULTRON_EFFORT` | `medium` | `low` answers faster, `high` thinks harder. |
| `ULTRON_WEB_SEARCH` | `on` | `off` disables web search. |
| `ULTRON_FALLBACKS` | `on` | If the model declines a request, the API retries it on another model. `off` disables that. |

The personality lives in `SYSTEM_PROMPT` at the top of `server.js`.

## Things to know

- **Voice quality depends on your browser and OS.** Speech uses the browser's built-in voices, so there is no extra service or key, but it will not sound like a film. A dedicated text-to-speech service would be the upgrade.
- **The microphone only works on `localhost` or HTTPS.** Browsers block it elsewhere.
- **There is no login.** By default the server only accepts connections from your own machine. If you set `HOST=0.0.0.0`, anyone on your network can use your API key through it.
- **Conversations are saved** in `data/sessions/` on the machine running the server, so it remembers across restarts. Delete that folder to forget everything.
- **API usage costs money.** Each message is a Claude API call; web searches are billed on top.
- Ultron is a Marvel character. This is a personal fan project; the face and all dialogue here are original, but don't ship it publicly under that name.
