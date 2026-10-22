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
0-100 km/h, how tough it is next to an average car and what it is best at, with the repair, the workshop
and "Switch car" (a grid of all your cars with their pictures). A big Drive button sits at the
foot of the sidebar, always in view. In a tall frame (a phone held upright, an A4 page) the
garage moves under the scene.

Three modes:

- **Free drive:** the city, yours to drive round. No clock, no score, no damage, no results: the
  boost fills back up by itself, and pause, Back to the garage when you are done.
- **Police chase:** a getaway. The police are right behind you from the start: down the
  motorway, through town, and out through the dock gates to escape (below).
- **Race:** one-on-one against a rival in the same kind of car through the city.

The header shows your best chase score, or races won. Nothing is ever wrecked, in any mode: a car
that rolls over is put back on its wheels on the road, and a car at 0% still drives.

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

- **Condition (0-100%) stays with the car between drives.** Damage happens in the chase and the
  race (free drive takes none). A big hit costs about half of an average car (at most 70%),
  scrapes a few percent, and tougher cars and body armour take less. A damaged car smokes,
  flashes its hazards, darkens, loses power and its engine misfires and rattles. Condition never
  ends a drive: at 0% the car keeps going, and next time it limps out at 25%.
- **Free repairs on the road:** whenever the car is damaged in a chase or a race, a wrench in a
  column of blue light waits on the road 170-260 m ahead. Drive through it for +40%. The HUD
  shows how far it is and which way; the map shows it too. Once it is behind you, another is
  laid ahead.
- **Coins:** about 1 per 20 points in a chase up to 20,000 points, a quarter of that beyond; 400
  and up for winning a race. Free drive earns none. Everyone starts with 500.
- **Repairs in the garage** cost coins in proportion to the damage (full condition in one go);
  without enough you fix what they cover.
- **Workshop:** six upgrades with five levels each: engine (+7% power a level), gearbox (+5% top
  speed), tires (+5% grip), brakes (+12%), body armour (-9% damage), nitro tank. Prices scale
  with the kind of car. With a host page connected it also offers "Find a mechanic" and "Parts
  for this car", which ask the host to open its own listings for that car.

Everything is kept in this browser (localStorage), or on the player's account if the host page
stores the progress the game sends it.

## Free drive

A random arterial in the city, then wherever you like: the traffic, the lights and the weather
carry on round you, and a map of the streets turns with you in the top corner. Passes, drifts and
oncoming lanes score nothing and nothing takes damage; a crash is just a bump. Drifting still
works (tap Space while steering at speed, hold the slide with the wheel) with smoke, skid marks
and squeal, and the boost (Shift) refills by itself. Conditions: noon, golden hour, midnight,
night rain (lower grip).

## Police chase

A road of its own (`highway/road.ts`, profile `chase`), laid out in full at the start, about
4.8 km from the start line to the dock gates:

1. **The motorway** (about 2.9 km): three lanes, sweeping bends, a tunnel, roadworks that cone
   off a lane, overpasses, sometimes a causeway over water, and signs counting down to Downtown
   and the docks. The other direction runs beside it with its own traffic.
2. **Town** (about 1.6 km): the median closes up and the buildings come in. A two-way street, two
   lanes each way with only a double yellow line between (cross over and the oncoming cars brake
   and honk), pavements and kerbs, buildings with lit floors and shop fronts, street lamps, and
   every block a cross street with a zebra crossing, signals and a barrier. Corners are tight
   (radius 42-115 m). Traffic drives at city speeds.
3. **The docks:** rows of shipping containers stacked up to four high either side, gantry cranes,
   fences, and the port gates with a chequered line 250 m in. Cross it and you have ESCAPED. Past
   the gates the quay ends at barriers and the water, with a container ship moored alongside.

The road's heading stays within about 50 degrees of where it started, so it never comes back
across itself. A popup marks getting into town and the docks coming up (600 m out).
Positions are metres along the road and metres across it. Pieces are built (meshes and
collision) as they come within 1.5 km and dropped once 450 m behind, and every 1.2 km the whole
world is moved back toward the start to keep coordinates small for the physics. The city is not
drawn while you are out here.

**The police:** two police cars sit right behind you on the line with their lights on, and go
when you do. They are real cars in the physics: they close in from behind, ram your back corner
to spin you, drop back for a moment after a hit and come again, get in front of you and brake
hard in your path, and use the hard shoulder, the pavement and (in town) the other direction's
lanes when theirs are blocked. Once you are stopped (crashed, spun, stuck behind traffic) they
box you in: the ones behind pull up on your bumper and the ones in front stop dead, and they stay
there. They corner nearly as hard as you and brake for traffic, but not always in time. A police
car takes a few real crashes to put out of action; bumping you does next to nothing to it.
Traffic moves over for them.

- **Heat (1-5)** rises every 45 s and with every two cars you take out: more police cars (2, 3,
  4, 4, 5 at once), faster ones (tuned against your car's top speed: a little slower than you at
  heat 1, so a clean run down an open road pulls away, about a tenth faster at heat 5, and
  quicker still once they have dropped well back, so a lead holds at about 150 m even on the
  boost), and from heat 3 roadblocks: police cars angled across every lane but one, 500 m ahead
  (the HUD warns you; none in the last stretch before the gates). Backup arrives from behind, and
  from heat 2 every other car joins from up ahead to cut you off.
- **Busted:** nearly stopped (under 22 km/h) with a police car within 14 m (a roadblock's
  counts) and the busted meter fills: about 3 s with one, under 2 s with two. It empties slowly,
  so rolling forward a metre does not reset it: crash with the police on you and you have a
  couple of seconds to reverse out and get going.
- **Scoring:** points for every second of the chase (more at higher heat), on top of near misses
  (under 1.15 m on these wide lanes; oncoming ones in town are worth double), drifts and
  SLIPSTREAM (2-14 m behind a car at speed refills the boost). Above 160 km/h the combo's window
  runs at half speed. TAKEDOWN for a police car you crash, COP CRASHED for one that crashes on its
  own, ROADBLOCK DODGED, and ESCAPED (3,000 + 1,000 per heat star). Giving up (pause, Give up)
  banks what you have. Chase scores have a top 10.
- **HUD:** how many are after you and the time, the heat stars, the distance to the docks with a
  progress bar marked Motorway · Town · Docks, score and combo, the busted meter when it fills,
  the roadblock warning, red and blue light at the edges of the screen when one is right on you,
  and a map of the road ahead with the police flashing on it and a "Docks 2.4 km" marker.

**How it ends:** busted, a BUSTED stamp comes down under flashing red and blue light bars;
escaped, the screen flashes and opens up in blue under an ESCAPED stamp (the police pull up and
switch their lights off). Both show the time, heat, takedowns and score, then the results: a line
on why it ended (out through the docks, boxed in 1.2 km from the docks, gave yourself up), the
time, takedowns, highest heat, near misses, top speed and how far short of the docks you were.

## Race

A random 1.6-2.3 km route through the city grid, from a two-car grid to a finish gate. The rival
drives the same kind of car as yours, painted to stand out, with a RIVAL tag. Pass the
checkpoint gates in order. A big hit stops you dead for a moment but never ends the race (and
never takes the car below 10%); rolling over or getting lost puts you back on the route, and T
does it on demand (T in the other modes puts you back on the road). Traffic is light: about 30
cars round you (around 10 within 150 m, one or two on the next 200 m of the route), appearing at
least 90 m away. The rival drives with its own AI (pure-pursuit steering, braking for corners
and traffic, overtaking, backing out of dead ends) and eases off when ahead so races stay close.
If it gets home first you have 30 seconds to finish. The HUD has position, clock, gap,
checkpoints, an arrow to the next gate and a map.

Turning is helped in every mode: more steering lock at speed, a little more grip, and the car
follows the wheel without sliding; drifts and handbrake turns are left alone.

**Controls:** W A S D drive, Shift boost, Space + steer to drift, mouse to look, Esc pause,
R restart, T back on the road (on the route in a race), E give up (chase, paused), Enter start. On phones
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
  the Doppler shift as they come and go (the two nearest, kept well under the engine), police radio at the start, for backup and
  roadblocks, a fanfare when you escape and a falling phrase when you are busted. In town,
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
    DriveGame.ts      game loop, the three modes, camera, traffic director, collisions
    scoring.ts        the scoring rules (pure, unit-tested)
    Highway.ts        the chase road: streaming, where cars are on it, traffic bodies, map
    highway/          road.ts (the road tree and its planning, pure), traffic.ts (pure),
                      police.ts (how a police car drives, pure), build.ts (meshes and collision
                      for a piece, downtown streets and the docks included)
    Chase.ts          the police chase: police cars, heat, backup, roadblocks, escaped, busted
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
npm run test:unit    # scoring (32), drift (40), turning help (6), race rules (13), garage (28), road generator (12), chase (22), view (5)
npm run test:race    # the rival AI racing itself through real physics and traffic (a few minutes)
npm run dev &        # then, in another shell:
npm run test:e2e     # drives the game in headless Chromium (36 checks)
```

`scripts/e2e-drive.mjs` covers the title screen and garage card, adding a car with the form,
buying an upgrade; free drive (the countdown, a close pass and a drift that score nothing, the
boost filling back up, pause, a hard crash that does no damage, a rolled car put back on its
wheels, back to the garage with no results, rain); the race (grid, rival, HUD, a crash,
checkpoints, back on track, winning and losing); the police chase (the police behind you on the
line, the motorway with the docks 4-6 km away, a near miss and a damaging crash, into town, the
docks, through the gates for ESCAPED and its results and coins, restart, a car at 0% limping out
and a wrench fixing it, giving up, a garage repair, being busted, the best chase on the title and
the loading screen after a reload); a `#garage=` host link, an A4 portrait frame (the garage
under the scene, a drive with nothing off the edge and the wider view), and the touch controls.
`scripts/chase-test.ts` lays the chase road for a dozen seeds and checks it goes motorway, town,
docks and stops there (no forks, nothing past the docks, the gates 4-6 km down the road), keeps
its heading bound and never comes back across itself, has tunnels only out of town and cross
streets on straights; that an oncoming car in town stops for you in its lane, that town traffic
keeps to city speeds and moves over for a siren; drives a police car (a simple car model)
behind you round the corners to check it stays on the road and catches up; and checks the
police box you in once you stop (one from behind pulls up on your bumper and stays, one ahead
stops in front of you) and brake in your path when ahead of you at speed.
`scripts/highway-test.ts` tests the road generator's other profile, the forking motorway of the
old Highway mode: no mode uses it now, but it is still in the generator. It lays 60 km of road
through forks and checks it joins up without gaps or kinks, that lanes carry straight into the
branches, that every feature and zone turns up, that points project back onto the road, and that roadworks close and reopen a lane. The suites also pass against the production build.

## Known limitations

- **Not connected to a real garage yet.** The host bridge and the `#garage=` link are built and
  tested with a stand-in page; no host has sent it real data.
- **Performance was only measured with software rendering** (SwiftShader in a headless
  container, 1-2 fps). Frame rates on real GPUs and phones are unknown; if it struggles, use
  MEDIUM or LOW.
- **Sound and music are untested by ear.** Levels were measured (nothing clips, the engine sits
  above the music) but nobody has listened to them.
- **The police chase was tuned with an autopilot,** not by people playing it. A stand-in driver
  (the police's own driving logic aimed far up the road, cornering hard, using the boost, never
  going for takedowns, and prone to stopping dead behind traffic) got 67-88% of the way to the
  docks in three runs and was busted each time; crashing with the police close behind ends in a
  bust about 3.5 s later unless you get moving. A person who weaves through traffic and takes
  police cars out should get through more often. It may need adjusting after real play.
- **Not tried inside Canva.** It was tested in an A4-sized sandboxed iframe with storage blocked,
  which is how such embeds usually run; Canva's own frame, size limits and permissions were not
  checked.
- **Touch controls were tested with emulated touch,** not on a phone.
- **Coins and upgrades are kept on the client.** If they ever turn into something with real
  value, the host has to validate drives on its server.
