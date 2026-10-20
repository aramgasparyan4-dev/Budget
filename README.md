# MyGarage Drive

Drive your own car. An arcade driving game for the browser, built to plug into the "My Garage"
feature on list.am: the car you saved in your garage is the car you drive, it gets damaged when
you crash, and you repair and upgrade it with coins you earn on the road. Everything (the city,
the motorway, the traffic, the cars, the sound and the music) is generated in code; there are no
downloaded art or audio assets.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/
node scripts/build-single.mjs index.html out.html   # everything in one HTML file
```

Needs a WebGL2 browser (recent Chrome, Edge, Firefox or Safari). `?preset=low|medium|high|ultra`
in the URL overrides the graphics preset; `?touch=1` forces the on-screen controls.

**Serving it:** `dist/` holds the page, a 0.6 MB (gzipped) script and the physics engine as
`assets/rapier-*.wasm` (3 MB, 1.2 MB gzipped). Serve `.wasm` as `application/wasm` (so it
compiles while it downloads) and compressed: many servers (nginx by default) do not compress
`.wasm` unless told to.

## How it looks

Styled after list.am's Garage, with the colours taken from the site: #0077FF blue for the one
main action, links and badges, near-black text, white surfaces with hairline #EAEAEA borders
instead of shadows, #F4F4F4 grey secondary buttons and fields, #FAFAFA detail panels, the
pink-red of its "NEW" badge for damage, thin outline icons (lucide) and Inter type. The list.am
logo is not included: drop the official asset into the header when it is approved.

The title screen: a white header (mode tabs, your best, coins, controls, settings), your car
parked at a curb, and the garage in a sidebar. Its card shows a picture of your car (rendered from
the same 3D model you drive, in its paint, darker when damaged), its condition, top speed,
0-100 km/h, how many hard hits it can take and what it is best at, with the repair, the workshop
and "Switch car" (a grid of all your cars with their pictures). A big Drive button sits at the
foot of the sidebar, always in view. On a phone held upright the sidebar moves under the scene.

Three modes:

- **Time attack:** score as much as you can in the city before the clock runs out.
- **Highway:** an endless, winding motorway with no clock (below).
- **Race:** one-on-one against a rival in the same kind of car through the city.

Each mode keeps its own best (time attack and highway scores, races won), shown in the header.

## Your car

The car comes from a garage: the same details a classifieds site's "My Garage" collects (make,
model, year, colour, condition, engine, gas equipment, wheel size, steering wheel, headlights),
either handed over by the host page or entered in the game's "Add new vehicle" form.
[docs/GARAGE-INTEGRATION.md](docs/GARAGE-INTEGRATION.md) is the spec for the connection.

The make and model pick one of ten kinds of car. Each has its own body, handling, engine sound
and one thing it is best at (checked by a unit test):

| Kind         | Best at              | Perk                         | Looks like                           | Sounds like                       |
| ------------ | -------------------- | ---------------------------- | ------------------------------------ | --------------------------------- |
| City compact | Cheapest to keep     | Half-price repairs, upgrades | short and tall, white roof           | a busy three-cylinder             |
| Family sedan | Earns the most       | +20% coins                   | plain three-box saloon               | a smooth four                     |
| Executive    | Longest boost        | Boost drains 35% slower      | long, chrome grille, sills, exhausts | a turbo V6, whistle and blow-off  |
| Sports coupe | Top speed and grip   | Fastest, most grip, fragile  | low and wide, tall rear wing         | a V8: burble, howl, crackle       |
| Hot hatch    | Agility and drifting | +50% drift points            | body kit, red stripe, roof spoiler   | a raspy turbo four, pops          |
| Crossover    | All weather          | Keeps its grip in the rain   | black cladding, roof rails           | a gruff four                      |
| Off-roader   | Toughest             | Takes the hardest hits       | snorkel, rack light bar, spare wheel | a clattering turbo-diesel six     |
| Pickup / van | Big points           | +30% near-miss points        | open bed, roll bar                   | a diesel four                     |
| Electric     | Fastest off the line | Boost refills 40% faster     | smooth, light bars, blue trim        | no engine: a motor whine          |
| Classic      | Legend status        | +50% score, cheap to fix     | upright, chrome everywhere           | a lumpy old carburettor four      |

Examples: Polo and i10 (compact), Camry and Elantra (sedan), E-Class (executive), M4 and 911
(sports), Golf GTI (hatch), RAV4 and Soueast DX5 (crossover), Land Cruiser (off-roader), Hilux
(pickup), Tesla and BYD (electric), Lada 2107 and Volga (classic). The catalogue
(`src/mygarage/garage/catalog.ts`) knows about 60 makes and their common models, in English and
Russian spellings; anything else is matched on model-name patterns ("pickup", "4x4", "GTI"...),
then the make's usual kind of car, then age (pre-1990 drives as a classic), and otherwise as a
family sedan. An electric engine always means Electric, and the player can override the match.
Diesel pulls harder, hybrid refills boost faster, gas equipment earns 10% more coins, bigger
wheels add grip, the colour is the paint, and a car listed as damaged arrives at 60%. Without a
car of your own there is a demo line-up, one of each kind, kept as test drives afterwards.

## Damage, coins, repairs, upgrades

- **Condition (0-100%) stays with the car between drives.** A big hit costs about half of an
  average car (at most 70%), scrapes a few percent, and tougher cars and body armour take less.
  A fresh car survives its first big hit; a family sedan is wrecked by the second, an off-roader
  by the third. A damaged car smokes, flashes its hazards, darkens and loses power. Below 10% it
  will not start until it is repaired.
- **Coins:** about 1 per 20 points in time attack; the same on the highway up to 20,000 points
  and a quarter of that beyond (drives have no end); 400 and up for winning a race. Everyone
  starts with 500.
- **Repairs** cost coins in proportion to the damage; without enough you fix what they cover,
  and a player who is broke with a wrecked car gets a free patch-up to 35%.
- **Workshop:** six upgrades with five levels each: engine (+7% power a level), gearbox (+5% top
  speed), tires (+5% grip), brakes (+12%), body armour (-9% damage), nitro tank. Prices scale
  with the kind of car. With a host page connected it also offers "Find a mechanic" and "Parts
  for this car", which ask the host to open its own listings for that car.

Everything is kept in this browser (localStorage), or on the player's account if the host page
stores the progress the game sends it.

## Time attack

Weave through dense city traffic. Passing a car with less than 1.7 m of side clearance is a near
miss (under 0.9 m a close call, under 0.4 m INSANE); oncoming passes count double and crossing
traffic one and a half times. Driving against traffic, drifts and red lights also feed the combo,
which multiplies up to x10 and banks after four quiet seconds; a scrape loses what hasn't
banked. Two close passes on opposite sides in quick succession are THREADED, a bonus. The clock
starts at 40 seconds and drains; risky driving buys time back. A big hit costs the combo, 5
seconds and condition; at 0% the run is over.

- **Conditions:** noon, golden hour, midnight, night rain (lower grip).
- **Drifting:** tap Space while steering at speed to kick the back out; hold the slide with the
  wheel. Drifts score by angle, speed and length ("BIG DRIFT", "MASSIVE DRIFT"); passes made
  mid-drift are worth 1.5x. Tire smoke, skid marks and squeal come with it.
- **Boost:** near misses fill the meter; hold Shift for more power and top speed; points earned
  while boosting are worth 1.5x.

## Highway

An endless motorway well away from the city, laid out as you drive (`src/mygarage/highway/`):

- **The road winds:** sweeping bends and tighter ones (radius 380 m and up: at 200 km/h you
  have to brake for some), joined by smooth transitions. Lanes come and go between three and
  five, with a taper where one ends.
- **Forks every 5-7 km:** the lanes split between two branches, signposted on an overhead
  gantry with where each goes and how busy it is ("City · heavy traffic", "Coast · light
  traffic"), also shown on the HUD and the map. Busier branches mean more cars to pass close.
  A crash cushion sits in the gore between them.
- **On and around it:** tunnels under hills, causeways over water, roadworks that cone off a lane
  (the traffic has to merge and slows to 75 km/h, so it bunches up), overpasses, signs, and the
  road for the other direction off to the left, with its own traffic, coming and going.
- **Scenery zones** change every few kilometres: fields, forest, coast (the sea beside the road),
  desert and the city (towers with lit floors, noise walls, street lamps).
- **Traffic** keeps to its lanes at 75-120 km/h (trucks and buses mostly on the right), follows
  the car ahead, overtakes with the indicator on (sometimes right in front of you), merges out
  of lanes that end or are closed, gets into lane for the branch it wants, and brakes for you
  (brake lights). It gets denser the further you go. A car you hit skids to a stop with its
  hazards on and stays in the way.
- **Scoring:** no clock: drive until you pause and pick **End drive** (or E while paused), or
  until the car is wrecked. On these wide lanes a near miss needs under 1.15 m (a pass down the
  middle of the next lane is just driving). Above 160 km/h the combo's window runs at half speed.
  Sitting 2-14 m behind a car at speed is a SLIPSTREAM: it refills the boost and keeps the combo
  ticking. Every 5 km is a bonus. Highway scores have their own top 10.
- **HUD:** distance and zone, score and combo, the next fork, and a map of the road ahead with
  both branches labelled and the traffic.

The road is a tree of paths (a fork ends one path and starts two); positions are metres along a
path and metres across it. Pieces are built (meshes and collision) as they come within 1.5 km
and dropped once 450 m behind; the branch not taken is dropped once you are past the split.
Every 1.2 km the whole world is moved back toward the start to keep coordinates small for the
physics. The city is not drawn while you are out here.

## Race

A random 1.6-2.3 km route through the city grid, from a two-car grid to a finish gate. The rival
drives the same kind of car as yours, painted to stand out, with a RIVAL tag. Pass the
checkpoint gates in order. A big hit stops you dead for a moment but never ends the race (and
never takes the car below 10%); rolling over or getting lost puts you back on the route, and T
does it on demand. The rival drives with its own AI (pure-pursuit steering, braking for corners
and traffic, overtaking, backing out of dead ends) and eases off when ahead so races stay close.
If it gets home first you have 30 seconds to finish. The HUD has position, clock, gap,
checkpoints, an arrow to the next gate and a map.

Turning is helped in every mode: more steering lock at speed, a little more grip, and the car
follows the wheel without sliding; drifts and handbrake turns are left alone.

**Controls:** W A S D drive, Shift boost, Space + steer to drift, mouse to look, Esc pause,
R restart, T back on the route (race), E end the drive (highway, paused), Enter start. On phones
and tablets there are on-screen controls (steering left, pedals right, boost and drift above
them); phones start on the LOW preset.

## Sound and music

All synthesised with Web Audio (`src/engine/`):

- **Engines** (`engineSound.ts`): each kind of car has its own engine, built from its firing
  pattern: the wave's harmonics follow the cylinders (a three's thrum, a crossplane V8's burble),
  a band of noise pulsed at the firing rate gives it bark on small speakers, and throttle opens
  the "muffler". Diesels clatter, turbos whistle and blow off, sporty cars crackle on lift-off,
  the classic hunts at idle. The electric car has no engine at all: a clean motor and inverter
  whine that rises with road speed, quieter when coasting. Road and wind noise grow with speed.
- **Picking a car** plays its door, then it starts up: the starter cranks, it catches and settles,
  and a blip of the throttle (an electric car wakes with a chime and a whine instead).
- **Music** (`music.ts`): a step sequencer with a few synth instruments. A slow lo-fi groove in
  the garage (electric piano, soft drums, round bass) and driving synthwave on the road (four on
  the floor, pumping pads, octave bass, an arpeggio and a lead that come and go every 8 bars).
  They cross-fade; the music dips when paused. Sound and music have separate switches in the
  settings menu.
- No background ambience. Near misses whoosh, combos chime up a scale, banks ring, crashes crunch
  and tinkle, buttons tick, upgrades ring the till; a limiter keeps the mix from clipping.

## Loading

The page shows its loading screen in plain HTML before any script runs. The physics engine is
shipped as a `.wasm` file the browser fetches in parallel (preloaded) and compiles while it
downloads, instead of a 4 MB base64 string inside the script (`build/rapierWasm.ts`, a build
plugin; the single-file build keeps the inlined copy). Shaders for the first view are compiled
during loading (in parallel where the browser supports it) so the first frame does not stall.
In the test container the title screen comes up in about 1.8 s (it was 4.7 s).

## Code

```
src/
  mygarage/   the game
    DriveGame.ts      game loop, modes, camera, traffic director, collisions
    scoring.ts        the scoring rules (pure, unit-tested)
    Highway.ts        the highway: streaming, your place on the road, traffic bodies, map
    highway/          road.ts (the road tree and its planning, pure), traffic.ts (pure),
                      build.ts (meshes and collision for a piece)
    race.ts, RaceSession.ts   routes, progress, the rival's driver; one race
    garage/           archetypes, catalogue, vehicles, economy, host bridge, store
    App.tsx, GarageUI.tsx, RaceUI.tsx, ui.tsx, theme.css, thumbs.ts (car pictures)
  engine/     World (city, chunks, terrain, collision, sky), input, physics, audio, engines, music
  game/       the drivable car and the camera
  world/      city generator, buildings, chunk geometry + worker, terrain
  render/     materials and shaders, chunks, sky and light, vehicles, rain, tire effects
  sim/        vehicle specs and city traffic
  state/      settings
  scene/      the R3F canvas and post-processing
build/        the build plugin that ships the physics engine as a file
```

MyGarage Drive started out on the engine of Echo City, a 3D city life simulation that was in
this repository; it has been moved out (its full code is in this repository's history up to
commit 13737f4).

## Testing

```bash
npm run typecheck
npm run test:unit    # scoring (31), drift (40), turning help (6), race rules (13), garage (29), highway road (12)
npm run test:race    # the rival AI racing itself through real physics and traffic (a few minutes)
npm run dev &        # then, in another shell:
npm run test:e2e     # drives the game in headless Chromium (35 checks)
```

`scripts/e2e-drive.mjs` covers the title screen and garage card, adding a car with the form,
buying an upgrade, picking a car and conditions, the countdown, near misses, combos, boost,
oncoming driving, drifting, pause, damage and a wreck, results with coins and condition, a
wrecked car refusing to start, repairs, running out of time, rain, the race (grid, rival, HUD, a
crash, checkpoints, back on track, winning and losing), a highway drive (80 seconds round the
bends with an autopilot, no clock, the world brought back toward the start, a near miss, a
crash, ending the drive for coins and its own best, the city coming back), the high score after
a reload, a `#garage=` host link, and the touch controls. `scripts/highway-test.ts` lays 60 km
of road through forks and checks it joins up without gaps or kinks, that lanes carry straight
into the branches, that every feature and zone turns up, that points project back onto the road,
and that roadworks close and reopen a lane. The suites also pass against the production build.

## Known limitations

- **Not connected to a real garage yet.** The host bridge and the `#garage=` link are built and
  tested with a stand-in page; no host has sent it real data.
- **Performance was only measured with software rendering** (SwiftShader in a headless
  container, 1-2 fps). Frame rates on real GPUs and phones are unknown; if it struggles, use
  MEDIUM or LOW.
- **Sound and music are untested by ear.** Levels were measured (nothing clips, the engine sits
  above the music) but nobody has listened to them.
- **Touch controls were tested with emulated touch,** not on a phone.
- **Coins and upgrades are kept on the client.** If they ever turn into something with real
  value, the host has to validate drives on its server.
