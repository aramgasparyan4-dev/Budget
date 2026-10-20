# Echo City

A 3D open-world urban life simulation that runs in a desktop browser. Everything — the city,
the buildings, the 640 residents, the cars, the textures and the sound — is generated in code
from a seed. There are no downloaded art or audio assets.

You start with $250 and a studio apartment. Work, drive, make friends, buy a car, open a
business. The residents have jobs, daily schedules, needs, personalities, memories of what
you did, and relationships with you and with each other.

This repo holds two games built on the same engine:

- **Echo City** (`index.html`): the life simulation described below.
- **MyGarage Drive** (`near-miss.html`): an arcade driving game in the same city where you drive
  your own car, from a classifieds-site garage or added by hand. See [MyGarage Drive](#mygarage-drive).

## Run it

```bash
npm install
npm run dev          # Echo City: http://localhost:5173 · MyGarage Drive: http://localhost:5173/near-miss.html
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

## MyGarage Drive

Drive your own car through city traffic. The car comes from a garage: the same details a
classifieds site's "My Garage" collects (make, model, year, colour, condition, engine, gas
equipment, wheel size, steering wheel, headlights), either handed over by the host page or
entered in the game's own "Add a vehicle" form. It is built to plug into the Garage feature on
list.am; [docs/GARAGE-INTEGRATION.md](docs/GARAGE-INTEGRATION.md) is the spec for that. The
page itself carries no host branding.

Two modes, picked on the title screen: **Free drive** (score attack against the clock) and
**Race** (one-on-one against a rival in the same kind of car). Your free-drive high score and
your race record (wins, races, biggest winning margin) show on the loading screen and the title
screen. The title screen shows your car parked at a curb under a street lamp.

### Your car

The make and model pick one of ten kinds of car. Each has its own body, its own handling and one
thing it is best at (checked by a unit test):

| Kind | Best at | Perk | Examples |
| --- | --- | --- | --- |
| City compact | Cheapest to keep | Repairs and upgrades cost half | Polo, Yaris, i10, Matiz |
| Family sedan | Earns the most | 20% more coins | Camry, Corolla, Elantra, Passat |
| Executive | Longest boost | Nitro drains 35% slower | E-Class, 5 Series, A6 |
| Sports coupe | Top speed and grip | The fastest car; fragile, dear to fix | 911, Mustang, M4 |
| Hot hatch | Agility and drifting | Drifts score 50% more | Golf GTI, Civic Type R |
| Crossover | All weather | Keeps most of its grip in the rain | RAV4, Tucson, Soueast DX5 |
| Off-roader | Toughest | Takes three big hits | Land Cruiser, Patrol, Niva |
| Pickup / van | Big points | Near misses worth 30% more | Hilux, L200, Sprinter |
| Electric | Fastest off the line | Boost refills 40% faster | Tesla, BYD, Ioniq 5 |
| Classic | Legend status | Every point counts 50% more | Lada 2107, Volga, W123 |

The catalogue (`src/nearmiss/garage/catalog.ts`) knows about 60 makes and their common models,
in English and Russian spellings; anything it does not know is matched on model-name patterns
("pickup", "van", "4x4", "GTI"...), then the make's usual kind of car, then age (pre-1990 drives
as a classic), and otherwise as a family sedan. An electric engine always means Electric, and
the player can override the match ("Drives as"). The other details tweak it a little: diesel
pulls harder, hybrid refills boost faster, gas (LPG/CNG) equipment earns 10% more coins, bigger
wheels add grip, the colour is the paint, and a car listed as damaged arrives at 60%.

Without a car of your own there is a demo line-up, one of each kind, which stays available as
test drives after you add yours.

### Damage, coins, repairs, upgrades

- **Condition (0-100%) stays with the car between runs.** A big hit costs about half of an
  average car (more for a harder crash, at most 70%), scrapes cost a few percent, and tougher
  cars and body armour take less. Every fresh car survives its first big hit; a family sedan is
  wrecked by the second, an off-roader by the third. A damaged car smokes, flashes its hazards,
  darkens and loses power and top speed. Below 10% it will not start until it is repaired.
- **Coins:** about 1 per 20 points in free drive, 400 and up for winning a race (more for a big
  margin), something for finishing. Everyone starts with 500.
- **Repairs** cost coins in proportion to the damage (the compact is cheapest, the sports coupe
  dearest); without enough coins you fix what they cover, and a player who is broke with a
  wrecked car gets a free patch-up to 35% so nobody is stuck.
- **Workshop:** six upgrades with five levels each: engine (+7% power a level), gearbox (+5% top
  speed), tires (+5% grip), brakes (+12%), body armour (-9% damage), nitro tank (slower drain,
  more boost at the start). Prices scale with the kind of car.
- When a host page is connected, the workshop also offers "Find a real mechanic" and "Shop real
  parts that fit this car", which ask the host to open its own listings for that car.

Everything is kept in this browser (localStorage), or on the player's account if the host page
stores the progress the game sends it.

### Free drive

Weave through dense city traffic as fast as you dare. Passing a car with less than 1.7 m of
side clearance is a near miss (under 0.9 m is a close call, under 0.4 m is INSANE); oncoming
passes count double and crossing traffic one and a half times. Driving against traffic,
drifts and running red lights also feed the combo. Every event raises the multiplier
(up to x10); the combo banks into your score after four quiet seconds, and a scrape loses
whatever hasn't banked. The clock starts at 40 seconds and drains; risky driving buys time
back.

A big hit loses the combo and 5 seconds and costs condition (see above); when the car reaches 0%
the run is over. A crash that bounces you into a second car within 1.5 s counts once. Rolling
the car also ends it.

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

### Race

A random 1.6-2.3 km route through the grid (legs of 2-5 blocks, left and right turns, never
crossing itself), from a two-car grid on an avenue to a checkered finish gate. The rival drives
the same kind of car as yours, painted to stand out from it (cyan, or orange if your car is blue),
and carries a floating RIVAL tag and a marker over its roof. Pass the checkpoint gates in order (the next one glows amber, the one
after shows in grey); a shortcut down another street gains nothing until you go back through
the gate you missed.

- **Crashes don't end the race.** A big hit stops your car dead for just under a second, then
  you carry on. It still costs condition, but a race never takes the car below 10%. The same
  goes for the rival. Rolling over or getting lost puts you back on the
  route; T does it on demand.
- **The rival** drives the route with its own AI: pure-pursuit steering on a lane, braking for
  corners and for traffic it can't get round, overtaking through other lanes (including
  oncoming ones on straights), watching for cars about to cross its path, and backing out of
  dead ends. When it is stuck out of your sight it is put back on the route. It speeds up a
  little when behind and eases off when ahead, so races stay close.
- **Finish:** first over the line wins. If the rival gets home first you have 30 seconds to
  finish. Results show both times (the rival's estimated from its pace if you beat it), the
  margin, crashes on both sides, and your near misses and drifts. Near misses and drifts still
  pop up during a race and still fill the boost bar, so risky driving pays off there too.
- **HUD:** position, race clock, gap to the rival in metres, checkpoint count, an arrow and
  distance to the next gate, a rotating map with the route, gates and rival, and wrong-way and
  off-route warnings. Race traffic is a little lighter than free drive.

Controls: W A S D drive, Shift boost, Space + steer to drift, mouse to look, Esc pause,
R restart (in a race: the same route again), T back on the route (race), Enter start.

On phones and tablets (or with `?touch=1`) there are on-screen controls: steering buttons on
the left, gas and brake on the right with boost and drift above them, pause and (in a race)
reset at the bottom. Short landscape screens get a compact title with the Drive button pinned
in the corner, and holding the phone upright during a run asks you to turn it. Phones start
on the LOW graphics preset.

It reuses Echo City's city generator, chunk renderer and shaders, sky and weather, Rapier car
physics (with an arcade drift layer that only Near Miss switches on), traffic simulation,
vehicle models and procedural audio. Its own code is in
`src/nearmiss/` (about 5,500 lines): the scoring rules (`scoring.ts`, pure and unit-tested),
routes, race progress and the rival's driver (`race.ts`, pure), one race with its rival car and
gates (`RaceSession.ts`), the garage (`garage/`: archetypes, catalogue, vehicle parsing, the
economy, the host bridge and its store, all pure except the store), the game loop and traffic
director (`NearMissGame.ts`) and the interface (`App.tsx`, `RaceUI.tsx`, `GarageUI.tsx`). The
ten garage bodies and their physics specs live with the other vehicles (`src/sim/vehicles.ts`
ids 9-18, never used for traffic; `src/render/vehicleModels.ts`).

## Architecture

```
src/
  nearmiss/  MyGarage Drive: scoring rules, race, garage, game loop, interface
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
npm run test:unit    # scoring (24 checks), drift handling (16), race rules (13), garage (29)
npm run test:race    # the rival AI racing itself through real physics and traffic (a few minutes)
npm run dev &        # then, in another shell:
npm run test:e2e     # drives both games in headless Chromium (needs Playwright's Chromium)
```

`scripts/e2e-nearmiss.mjs` (33 checks) covers the title screen with the parked car and garage
card, adding a car with the garage form (a Soueast DX5 drives as a white crossover), buying an
upgrade, picking a car and conditions, the countdown, a scripted near miss, combo banking, boost, oncoming driving, a drift (scored, with
skid marks and smoke), pause, a first crash that damages the car and a second that wrecks it,
the results screen with coins and condition, a wrecked car refusing to start until it is
repaired, repairing it, restart, running out of time (and the coins for it), the rain grip
penalty, and
the race: the grid and both colours, the rival driving off at GO, the race HUD, a crash that
stops the car without ending the race, passing a checkpoint, T back on track, winning, losing
after the rival finishes, the high score on the loading screen after a reload, a `#garage=`
host link bringing in the player's cars (a damaged Lada 2107 with gas equipment arrives as a
classic at 60% that earns extra coins), and the touch controls driving the car.
`scripts/garage-test.ts` checks the catalogue against real cars, that every kind of car really is
best at what it claims, the damage rules, the economy, and that hostile host payloads and corrupt
saves are cleaned up.
`scripts/race-test.ts` races two AI cars over six routes through the real city collision and
traffic, and checks that they finish and how fast. `scripts/drift-test.ts` drives each
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

- **MyGarage Drive is not connected to a real garage yet.** The host bridge and the `#garage=`
  link are built and tested with a stand-in page, but no host has sent it real data. The
  catalogue covers common cars in Armenia and falls back sensibly for the rest; a host with a
  body-type field per model could send `archetype` directly instead.
- **Touch controls were tested with emulated touch in headless Chromium, not on a phone**, and
  phone performance is unknown (the city is heavy; phones start on LOW).
- **Coins and upgrades are kept on the client.** That is fine while they only matter in the game;
  if they ever turn into something with real value (site bonus points, discounts), the host has
  to validate runs on its server, because a browser save can be edited.

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
