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

**Any frame, any shape:** the game fills whatever it is given: a browser window, a phone either
way up, or a page in another app (an A4 page in Canva, an iframe). In a tall frame the garage
sits under the scene, the driving camera opens its field of view (so you still see to the sides)
and sits the car lower (so you see the road ahead); in a frame smaller than about 820 x 560 the
whole interface scales down to fit instead of overlapping. In a sandboxed frame with no storage
the game still runs; progress then lasts for the visit. Click into it first so it gets the
keyboard.

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
foot of the sidebar, always in view. In a tall frame (a phone held upright, an A4 page) the
garage moves under the scene.

Four modes:

- **Time attack:** score as much as you can in the city before the clock runs out.
- **Highway:** an endless, winding motorway with no clock (below).
- **Police chase:** downtown streets and motorway with the police after you: get away, or get
  busted (below).
- **Race:** one-on-one against a rival in the same kind of car through the city.

Each mode keeps its own best (time attack, highway and chase scores, races won), shown in the
header.

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
  by the third. A damaged car smokes, flashes its hazards, darkens, loses power and its engine
  misfires and rattles. It always drives: a wrecked car limps out at 25%.
- **Free repairs on the road:** whenever the car is damaged, a wrench in a column of blue light
  waits on the road 170-260 m ahead (in every mode: on the street, the motorway, the race
  route). Drive through it for +40%. The HUD shows how far it is and which way; the map shows it
  too. Once it is behind you, another is laid ahead.
- **Coins:** about 1 per 20 points in time attack; the same on the highway up to 20,000 points
  and a quarter of that beyond (drives have no end); 400 and up for winning a race. Everyone
  starts with 500.
- **Repairs in the garage** cost coins in proportion to the damage (full condition in one go);
  without enough you fix what they cover.
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

## Police chase

A road of its own (`highway/road.ts`, profile `chase`) that alternates between downtown and open
motorway, every 1.2-2.3 km:

- **Downtown:** a two-way street, two lanes each way with only a double yellow line between
  (cross over and the oncoming cars brake and honk), pavements and kerbs, buildings right at the
  pavement with lit floors and shop fronts, street lamps, and every block a cross street with a
  zebra crossing, signals over the lanes and a barrier across it. Corners are tight (radius 40-115
  m, up to about 90 degrees). Traffic drives at city speeds.
- **Out of town:** the street opens into a boulevard with a planted median, then a three-lane
  motorway (sweeping bends, tunnels, roadworks, causeways), then closes back into town.
- The road's heading stays within about 50 degrees of where it started, so however it winds it
  never comes back across itself.

**The police:** a patrol car waits parked on the pavement ahead. Drive past it (or hit it) and the
chase is on: lights and siren, SPOTTED. The police cars are real cars in the physics: they close
in from behind, ram your back corner to spin you, drop back for a moment after a hit and come
again, block you from in front, and use the hard shoulder, the pavement and (downtown) the other
direction's lanes when theirs are blocked. They corner nearly as hard as you and brake for
traffic, but not always in time. Traffic moves over for them.

- **Heat (1-5)** rises with every 30 s of pursuit and every two cars you take out: more police
  cars (2, 3, 4, 4, 5 at once), faster ones (tuned against your car's top speed: about as fast as
  you at heat 1, a quarter faster at heat 5, and quicker still when they have dropped back, even
  if you are on the boost), and from heat 2 roadblocks: police cars angled across every lane but
  one, 500 m ahead (the HUD warns you). Backup arrives from well behind you, and from heat 2 every
  other car joins from up ahead to cut you off.
- **Escape:** stay more than 240 m from every police car and the escape meter fills over 9 s
  (5 s beyond 420 m); come within 170 m and it drains. While it is filling no backup is sent, so
  the way out is to wreck or lose the ones on you and keep going. Full: ESCAPED, a big bonus, and
  a quiet spell until the next patrol car spots you (the heat stays).
- **Busted:** slow to a crawl with a police car within 10 m and the busted meter fills; about
  three seconds and it is over (quicker with more of them). A wreck ends it too.
- **Scoring:** points for every second with the police after you (more at higher heat), on top of
  near misses (oncoming ones downtown are worth double), drifts and slipstreams. TAKEDOWN for a
  police car you wreck, COP CRASHED for one that wrecks itself, ROADBLOCK DODGED, ESCAPED. No
  clock; End drive (pause) banks it. Chase scores have their own top 10; coins as the highway.
- **HUD:** heat stars, pursuit / losing them / lost them, the escape meter and how many are after
  you, the busted meter when it fills, the roadblock warning, red and blue light at the edges of
  the screen when one is right on you, and the map with the police flashing on it.

**How a run ends:** wrecked, the picture drains of colour and the screen cracks from the point of
impact, under a big WRECKED; busted, a BUSTED stamp comes down under flashing red and blue light
bars, with the heat, how long they chased you and your score. The results then say why it ended
in a line (the police boxed you in at heat 3, one hit too many, rolled it over, out of time) next
to an icon, with a red and blue stripe for a bust.

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
R restart, T back on the route (race), E end the drive (highway and chase, paused), Enter start. On phones
and tablets there are on-screen controls (steering left, pedals right, boost and drift above
them); phones start on the LOW preset.

## Sound and music

All synthesised with Web Audio (`src/engine/`):

- **Engines** (`engineSound.ts`): each kind of car has its own engine, built from its firing
  pattern: the wave's harmonics follow the cylinders (a three's thrum, a crossplane V8's burble),
  a band of noise pulsed at the firing rate gives it bark on small speakers, and throttle opens
  the "muffler". Diesels clatter, turbos whistle and blow off, sporty cars crackle on lift-off,
  the classic hunts at idle. The revs follow a six-speed gearbox spread over the car's top speed
  (they climb through each gear and drop at the shift, with a moment of cut power, a bark from a
  sporty exhaust and a hiss from a turbo; later shifts with more throttle; you can rev it on the
  line in the countdown), and it stutters on the rev limiter flat out at top speed. The note
  wobbles a little like a real one, the intake roars under load, and two slightly different
  exhaust pipes, one each side, give it resonance and stereo width. A damaged engine misfires and
  rattles. Boost adds a nitrous hiss. The electric car has no engine at all: a clean motor and
  inverter whine and its reduction gear, rising with road speed, quieter when coasting. Road and
  wind noise grow with speed, and the tyres thump over joints in the road.
- **The police:** sirens that switch between wail and yelp, placed left or right of you with
  the Doppler shift as they come and go (the two nearest, kept well under the engine), police radio when they spot you or
  call backup, a fanfare when you escape and a falling phrase when you are busted. Downtown,
  cars coming the other way honk when you are in their lane. A wrench pickup ratchets and chimes.
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
    Highway.ts        the highway and chase road: streaming, where cars are on it, traffic bodies, map
    highway/          road.ts (the road tree and its planning, pure), traffic.ts (pure),
                      police.ts (how a police car drives, pure), build.ts (meshes and collision
                      for a piece, downtown streets included)
    Chase.ts          the police chase: police cars, heat, backup, roadblocks, escape, busted
    pickups.ts        the wrenches on the road (free repairs)
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
npm run test:unit    # scoring (31), drift (40), turning help (6), race rules (13), garage (28), highway road (12), chase (15), view (5)
npm run test:race    # the rival AI racing itself through real physics and traffic (a few minutes)
npm run dev &        # then, in another shell:
npm run test:e2e     # drives the game in headless Chromium (38 checks)
```

`scripts/e2e-drive.mjs` covers the title screen and garage card, adding a car with the form,
buying an upgrade, picking a car and conditions, the countdown, near misses, combos, boost,
oncoming driving, drifting, pause, damage and a wreck, results with coins and condition, a
wrecked car limping out and a wrench on the road fixing it, garage repairs, running out of time,
rain, the race (grid, rival, HUD, a
crash, checkpoints, back on track, winning and losing), a highway drive (80 seconds round the
bends with an autopilot, no clock, the world brought back toward the start, a near miss, a
crash, ending the drive for coins and its own best, the city coming back), a police chase
(downtown two-way streets, the patrol car pulling out after you, being busted and the results),
the high score after a reload, a `#garage=` host link, an A4 portrait frame (the garage under the
scene, a drive with nothing off the edge and the wider view), and the touch controls.
`scripts/chase-test.ts` lays 40 km of chase road and checks it keeps its heading bound and never
comes back across itself, that streets and motorway take turns, that cross streets sit on
straights; that an oncoming car downtown stops for you in its lane, that downtown traffic keeps
to city speeds and moves over for a siren; and drives a police car (a simple car model) behind
you round the corners to check it stays on the road and catches up. `scripts/highway-test.ts` lays 60 km
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
- **The police chase was tuned with an autopilot,** not by people playing it. A stand-in driver
  (the police's own driving logic aimed far up the road, cornering hard, using the boost) gets
  busted after one and a half to two and a half minutes of pursuit and escapes now and then at
  heat 1; a person who takes police cars out may do better. It may need adjusting after real play.
- **Not tried inside Canva.** It was tested in an A4-sized sandboxed iframe with storage blocked,
  which is how such embeds usually run; Canva's own frame, size limits and permissions were not
  checked.
- **Touch controls were tested with emulated touch,** not on a phone.
- **Coins and upgrades are kept on the client.** If they ever turn into something with real
  value, the host has to validate drives on its server.
