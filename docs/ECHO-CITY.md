# Echo City

Echo City is the first game built in this repo, and the engine MyGarage Drive runs on. It will
move to its own project; until then it is served at `/echo-city/` (`npm run dev`, then
http://localhost:5173/echo-city/).

A 3D open-world urban life simulation that runs in a desktop browser. Everything — the city,
the buildings, the 640 residents, the cars, the textures and the sound — is generated in code
from a seed. There are no downloaded art or audio assets.

You start with $250 and a studio apartment. Work, drive, make friends, buy a car, open a
business. The residents have jobs, daily schedules, needs, personalities, memories of what
you did, and relationships with you and with each other.

## Controls

| Key         | Action                                                          |
| ----------- | --------------------------------------------------------------- |
| W A S D     | Move / drive                                                    |
| Mouse       | Look (click the game to capture the mouse; dragging also works) |
| Shift       | Sprint                                                          |
| Ctrl / C    | Walk slowly                                                     |
| Space       | Jump · handbrake                                                |
| E           | Interact: talk, enter buildings, shop, work                     |
| F           | Enter / exit vehicle                                            |
| H           | Horn                                                            |
| Tab         | Phone                                                           |
| M           | City map                                                        |
| I           | Bag                                                             |
| 1–9         | Dialogue / mini-game choices                                    |
| Esc         | Pause / close                                                   |
| F3          | Performance overlay                                             |
| Mouse wheel | Camera distance                                                 |

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

## Testing

```bash
npm run test:sim     # headless 3-day simulation of all residents and the economy
node scripts/e2e.mjs && node scripts/e2e-systems.mjs   # with npm run dev running
```

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

## Known limitations

- **The local LLM dialogue hook was not tested against a real server.**
- No street-name signs in the world (names appear on the HUD, minimap and map); no umbrellas;
  no port cranes.
- One city size; no streaming beyond the generated area.
- Active food/courier/taxi jobs and city events are not saved (employment, business, cars,
  relationships and everything else are).
- Desktop only: no touch or gamepad controls.
- The economy is balanced against a 3–4 day headless run; very long play may still drift.
