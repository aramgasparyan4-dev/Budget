# Echo City

A 3D open-world urban life simulation that runs in a desktop browser. Everything — the city,
the buildings, the 640 residents, the cars, the textures and the sound — is generated in code
from a seed. There are no downloaded art or audio assets.

You start with $250 and a studio apartment. Work, drive, make friends, buy a car, open a
business. The residents have jobs, daily schedules, needs, personalities, memories of what
you did, and relationships with you and with each other.

This repo holds two games built on the same engine:

- **Echo City** (`index.html`): the life simulation described below.
- **Near Miss** (`near-miss.html`): an arcade driving game set in the same city. See [Near Miss](#near-miss).

## Run it

```bash
npm install
npm run dev          # Echo City: http://localhost:5173 · Near Miss: http://localhost:5173/near-miss.html
npm run build        # type-check + production build of both games into dist/
npm run preview      # serve dist/
```

Needs a WebGL2 browser (recent Chrome, Edge or Firefox). The game picks a graphics preset
from your settings; `?preset=low|medium|high|ultra` in the URL overrides it.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look (click the game to capture the mouse; dragging also works) |
| Shift | Sprint |
| Ctrl / C | Walk slowly |
| Space | Jump · handbrake |
| E | Interact: talk, enter buildings, shop, work |
| F | Enter / exit vehicle |
| H | Horn |
| Tab | Phone |
| M | City map |
| I | Bag |
| 1–9 | Dialogue / mini-game choices |
| Esc | Pause / close |
| F3 | Performance overlay |
| Mouse wheel | Camera distance |

## What is in the game

**City.** Deterministic seed-based generation of a 12×12 block grid (about 1.2 × 1.2 km) with six
districts — Downtown, Maplewood (residential), Market Quarter (commercial), Ironworks
(industrial), Bayview Heights (wealthy) and Neon Row (entertainment). Arterial and local roads
with lane markings, crosswalks, traffic signals and stop signs, sidewalks, named streets and
addresses; about 890 buildings and 560 businesses for the default seed, parks, plazas, parking
lots, a harbour on the east bay and forested hills around the edge. Geometry is built per
192 m chunk in a Web Worker; street detail (markings, props, signal heads, light pools) loads
within a detail radius.

**Rendering.** Three.js through React Three Fiber. Procedural facade shaders (windows, brick,
siding, storefronts, neon) with lit windows at night, wet-road puddles, sky dome with sun, moon,
stars and clouds, day/night lighting, shadows, fog, rain particles with splashes. Post-processing
on MEDIUM and up: bloom, SMAA, ACES tone mapping, time-of-day colour grading, vignette; ambient
occlusion on HIGH and ULTRA. Characters are shader-animated instanced humans (walk, run, sit, talk, wave, drive,
dance and more).

**Player.** Third-person capsule controller (Rapier) with sprint, stamina, jump, camera
collision, adjustable sensitivity, field of view and camera distance. Hunger and energy needs.

**Residents.** 640 NPCs simulated all the time, cheaply, away from the player, and shown as
pedestrians, drivers or customers near the player. Each has traits (sociability, ambition,
patience, confidence, kindness, risk, curiosity), needs, money, a home, often a job with shifts,
a 24-hour schedule chosen by utility scoring that adapts to weather, appointments and events,
goals, memories (type, participants, importance, emotional impact, decay over time) and
relationships (friendship, trust, familiarity, romance, professional, rivalry) — with you and
with each other. They meet, chat, argue, date, get hired and fired, buy cars, and text you.

**Conversations.** Walk up to anyone and press E. Lines are generated from their personality,
mood, job, relationship stage, memories of you, local news and gossip. Options include small
talk, work, local news, asking for help or directions, offering help, inviting them out, gifts,
flirting (once you know someone) and being rude (they remember). Optional: point Settings → Gameplay → Local LLM at an
OpenAI-compatible endpoint (for example Ollama) and residents improvise replies; it falls back
to the built-in system on any error or after 7 s.

**Traffic.** Lane-based vehicles with an IDM car-following model, signal phases, stop-sign
priority, turns through intersections, left-turn yielding, lane changes, parking manoeuvres,
honking, density by time of day, and residents commuting by car. Nine vehicle types.

**Driving.** Rapier ray-cast vehicles with suspension, engine curve, braking, handbrake,
per-type mass, grip and top speed, chase camera, speedometer, collisions that NPC drivers
remember. You can also take cars from traffic (a crime that witnesses remember).

**Economy.** Every business has staff, wages, rent, stock, prices, reputation and daily
profit/loss; prices react to demand; unprofitable businesses close and reopen under new
management; a wholesale price index follows supply and demand. The 640 residents shop at real
businesses; demand from the rest of the (unsimulated) city is modelled from staff on shift,
reputation, price, district, time of day and weather.

**Making money.** Food deliveries (orders come from residents who are actually at home and
hungry), courier van routes, taxi shifts with hailing pedestrians, steady jobs with shifts
played as short mini-games (barista, cashier, office, warehouse) and promotions, freelance gigs
from a home PC, favours for residents, buying wholesale goods and selling them to shops that run
low, and buying a storefront to run your own business (hire staff, set prices, renovate,
market). Spend it on food, clothes, a car from Echo Motors, apartment upgrades or a bigger home.
Wallet and bank are separate; rent is charged weekly.

**Interiors.** Apartments, cafés, restaurants, shops, clothing stores, offices, the bank, the car
dealership, bars, clubs, the courier depot, hotels, gyms and cinemas — each with staff and
customers who are the actual residents present there.

**Weather and time.** Sunny, cloudy, rainy, foggy and stormy weather with forecasts, wet roads,
lightning and thunder. A full day lasts 48 real minutes at the default speed. Streetlights and
windows come on at night; residents stay in when it pours.

**Phone (Tab).** Maps with waypoints, Contacts (relationship, personality, memories, locate),
Messages (including invitations you can accept), Bank, Jobs, News, Goals, Bag, Calendar,
Home upgrades, Business management and Settings.

**City events.** Traffic accidents, road construction, street gatherings, power outages,
sales, public disputes you can step into, storm warnings and job tips — reported in the news.

**Menus and saves.** Main menu with character creation and city seed, pause menu, settings
(graphics presets LOW/MEDIUM/HIGH/ULTRA plus individual options, audio, controls, gameplay),
controls and credits. Saves go to IndexedDB: an autosave (when you sleep and every 5 minutes)
plus three manual slots with thumbnails. A save holds the player, money, inventory, seed, time,
weather, every resident's state, relationships and memories, businesses, owned cars, your job,
your business, objectives and settings.

**Intro and goals.** An opening cinematic, then a tutorial (look, walk, go home, phone, take a
delivery, deliver it, meet someone, earn $500) followed by longer life goals with rewards.

## Near Miss

Weave through dense city traffic as fast as you dare. Passing a car with less than 1.7 m of
side clearance is a near miss (under 0.9 m is a close call, under 0.4 m is INSANE); oncoming
passes count double and crossing traffic one and a half times. Driving against traffic,
drifts and running red lights also feed the combo. Every event raises the multiplier
(up to x10); the combo banks into your score after four quiet seconds, and a scrape loses
whatever hasn't banked. The clock starts at 40 seconds and drains; risky driving buys time
back. A big hit ends the run.

- **Cars:** Volta GT (fast), Patrol Cruiser (heavy, lights on), Echo Cab (forgiving), Pixie
  Compact (small enough for gaps nothing else fits through).
- **Conditions:** midnight, night rain (lower grip), golden hour, noon.
- **Drifting:** tap Space (or the brake) while steering at speed to kick the back out, keep
  steering into the slide to hold it and counter-steer to straighten. The car settles at about
  20-25 degrees and keeps most of its speed, so you can slide round corners. Points build
  with angle and speed while you slide; a drift of 0.6 s or more scores as one move and raises
  the multiplier ("BIG DRIFT" over 28 degrees, "MASSIVE DRIFT" over 40). Near misses made
  mid-drift are worth 1.5x. Hitting something mid-drift loses it. Tire smoke, skid marks and
  squeal come with it.
- **Boost:** near misses fill the meter; hold Shift for more power and top speed, and points
  earned while boosting are worth 1.5x.
- **Traffic:** a director keeps a stream of slower and oncoming cars on the road ahead of
  you, and traffic gets denser the longer you survive.
- **Scores:** your top 10 runs are kept in this browser (localStorage).

Controls: W A S D drive, Shift boost, Space + steer to drift, mouse to look, Esc pause,
R restart, Enter start, ← → pick a car.

It reuses Echo City's city generator, chunk renderer and shaders, sky and weather, Rapier car
physics (with an arcade drift layer that only Near Miss switches on), traffic simulation,
vehicle models and procedural audio. Its own code is in
`src/nearmiss/` (about 1,500 lines): the scoring rules (`scoring.ts`, pure and unit-tested),
the game loop and traffic director (`NearMissGame.ts`) and the interface (`App.tsx`).

## Architecture

```
src/
  nearmiss/  Near Miss: scoring rules, game loop, interface
  core/      seeded RNG, noise, math helpers
  world/     city generator, buildings, names, chunk geometry + worker, terrain
  render/    materials/shaders, chunk manager, sky/lighting, humans, vehicles, rain, terrain
  engine/    World (city + chunks + terrain + collision + sky, shared by both games), input,
             Rapier physics wrapper, procedural Web Audio
  sim/       clock, weather, economy, NPC population + life simulation, pedestrians,
             sidewalk navigation, traffic, dialogue lines, LLM hook
  game/      Game (engine loop), Session (one playthrough), player/camera/vehicle controllers,
             interiors, jobs, dialogue, objectives, business, events, mini-games,
             save system, menu flow
  ui/        HUD, minimap, map, phone, dialogue, shops, menus, settings (React + Tailwind)
  state/     zustand stores and settings
  scene/     R3F canvas and post-processing
```

The simulation is plain TypeScript classes; React only draws the interface, which receives
throttled state from zustand stores. The game loop runs in an R3F frame callback.

Performance measures: chunked city with worker-built merged geometry, instancing for props,
vegetation, people and vehicles, detail and draw-distance radii per preset, distance-based
switching between abstract NPC simulation and visible proxies, time-sliced NPC updates,
pooled pedestrian and traffic proxies, kinematic physics bodies only near the player,
throttled HUD updates.

## Testing

```bash
npm run typecheck
npm run test:sim     # headless 3-day simulation of all residents and the economy
npm run test:unit    # Near Miss scoring rules (18 checks) and drift handling (16 checks)
npm run dev &        # then, in another shell:
npm run test:e2e     # drives both games in headless Chromium (needs Playwright's Chromium)
```

`scripts/e2e-nearmiss.mjs` (16 checks) covers the title screen, car and condition choice, the
countdown, a scripted near miss, combo banking, boost, oncoming driving, a drift (scored, with
skid marks and smoke), pause, a crash into a stopped car, the results screen and leaderboard,
restart, running out of time and the rain grip penalty. `scripts/drift-test.ts` drives each
Near Miss car in Rapier without a browser and checks that drifts hold an angle, keep speed
and end cleanly, and that Echo City's cars (no drift assist) still grip. Like the Echo City suites it also passes against the production build.

`scripts/e2e.mjs` (21 checks) and `scripts/e2e-systems.mjs` (11 checks) dispatch real key and
mouse events to the page and advance the game with `window.__echo.simulate()`. They cover:
menu → character creation → intro, walking, sprinting, jumping, building collision, tutorial
steps, entering/leaving buildings, phone and map, a full food delivery, talking to a resident,
driving and braking, buying food, rain and night, save → quit → continue, pause, sleeping,
multi-day simulation, switching to a new city seed, the bank, a full employment shift with
mini-game and wages, a taxi fare, buying and driving a car, buying a business, save/load of
job + car + business, city events, setting a map waypoint, and switching graphics presets
mid-game — with zero runtime errors. Both suites also pass against the production build.
Set `URL` and `CHROME` to point them somewhere else.

## Known limitations and what remains

- **Performance was only measured with software rendering** (SwiftShader in a headless
  container, ~1–2 fps for real frames). The game was not run on a real GPU while it was being
  built, so actual frame rates per preset are unknown. If HIGH/ULTRA struggle, use MEDIUM or LOW
  or lower the draw distance and densities.
- **Audio is untested by ear.** It is synthesised with Web Audio and runs without errors, but
  levels and mix were not listened to.
- **The local LLM dialogue hook was not tested against a real server.**
- No street-name signs in the world (names appear on the HUD, minimap and map); no umbrellas;
  no port cranes.
- One city size; no streaming beyond the generated area.
- Active food/courier/taxi jobs and city events are not saved (employment, business, cars,
  relationships and everything else are).
- The main JavaScript bundle is large (≈6.3 MB, 2.3 MB gzipped, much of it the Rapier
  WebAssembly module); it is not code-split.
- Desktop only: no touch or gamepad controls.
- The economy is balanced against a 3–4 day headless run; very long play may still drift.
