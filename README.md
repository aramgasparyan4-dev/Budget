# MyGarage Drive

Drive your own car through a living city. An arcade driving game for the browser, built to plug
into the "My Garage" feature on list.am: the car you saved in your garage is the car you drive,
it gets damaged when you crash, and you repair and upgrade it with coins you earn on the road.
Everything (the city, the traffic, the cars, the sound) is generated in code; there are no
downloaded art or audio assets.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/
```

Needs a WebGL2 browser (recent Chrome, Edge, Firefox or Safari). `?preset=low|medium|high|ultra`
in the URL overrides the graphics preset; `?touch=1` forces the on-screen controls.

The repo also holds **Echo City** (`/echo-city/`), the 3D life simulation whose engine (city
generator, traffic, physics, sky and weather) MyGarage Drive is built on. It will become its own
project; until then it lives here unchanged. See [docs/ECHO-CITY.md](docs/ECHO-CITY.md).

## How it works

The car comes from a garage: the same details a
classifieds site's "My Garage" collects (make, model, year, colour, condition, engine, gas
equipment, wheel size, steering wheel, headlights), either handed over by the host page or
entered in the game's own "Add new vehicle" form. It is built to plug into the Garage feature on
list.am and is styled after it, with the colours taken from the site: #0077FF blue for the one
main action, links and badges, near-black text, white surfaces with hairline #EAEAEA borders
instead of shadows, #F4F4F4 grey secondary buttons and fields, #FAFAFA detail panels, the
pink-red of its "NEW" badge for damage, thin outline icons (lucide) and Inter type.
[docs/GARAGE-INTEGRATION.md](docs/GARAGE-INTEGRATION.md) is the spec for the connection. The
list.am logo is not included: drop the official asset into the header when it is approved.

The title screen is a white header (mode tabs, your best, coins, controls, settings and the
Drive button), your car parked at a curb in the middle, and a sidebar with the car's garage
card: condition, top speed, 0-100 km/h, how many hard hits it can take, what it is best at, and
the workshop. Three modes:

- **Time attack:** score as much as you can before the clock runs out.
- **Highway:** an endless motorway with no clock. Weave through traffic at speed until you end
  the drive or wreck the car.
- **Race:** one-on-one against a rival in the same kind of car.

Each mode keeps its own best (time attack and highway scores, races won), shown in the header,
and the loading screen shows the time attack high score and the race record.

## Your car

The make and model pick one of ten kinds of car. Each has its own body, its own handling and one
thing it is best at (checked by a unit test):

| Kind         | Best at              | Perk                          | Looks like                           | Examples                        |
| ------------ | -------------------- | ----------------------------- | ------------------------------------ | ------------------------------- |
| City compact | Cheapest to keep     | Half-price repairs, upgrades  | short and tall, white roof           | Polo, Yaris, i10, Matiz         |
| Family sedan | Earns the most       | +20% coins                    | plain three-box saloon               | Camry, Corolla, Elantra, Passat |
| Executive    | Longest boost        | Boost drains 35% slower       | long, chrome grille, sills, exhausts | E-Class, 5 Series, A6           |
| Sports coupe | Top speed and grip   | Fastest, most grip, fragile   | low and wide, tall rear wing         | 911, Mustang, M4                |
| Hot hatch    | Agility and drifting | +50% drift points             | body kit, red stripe, roof spoiler   | Golf GTI, Civic Type R          |
| Crossover    | All weather          | Keeps its grip in the rain    | black cladding, roof rails           | RAV4, Tucson, Soueast DX5       |
| Off-roader   | Toughest             | Takes the hardest hits        | snorkel, rack light bar, spare wheel | Land Cruiser, Patrol, Niva      |
| Pickup / van | Big points           | +30% near-miss points         | open bed, roll bar                   | Hilux, L200, Sprinter           |
| Electric     | Fastest off the line | Boost refills 40% faster      | smooth, light bars, blue trim        | Tesla, BYD, Ioniq 5             |
| Classic      | Legend status        | +50% score, cheap to fix      | upright, chrome everywhere           | Lada 2107, Volga, W123          |

There is no background ambience (city rumble, wind, birds): you hear the car, the tyres, the
traffic you pass and the game's cues. Picking a car plays its door and a short rev that sounds like it: deeper for heavy cars, higher
and sharper for light powerful ones, a rising whine for an electric car.

The catalogue (`src/mygarage/garage/catalog.ts`) knows about 60 makes and their common models,
in English and Russian spellings; anything it does not know is matched on model-name patterns
("pickup", "van", "4x4", "GTI"...), then the make's usual kind of car, then age (pre-1990 drives
as a classic), and otherwise as a family sedan. An electric engine always means Electric, and
the player can override the match ("Drives as"). The other details tweak it a little: diesel
pulls harder, hybrid refills boost faster, gas (LPG/CNG) equipment earns 10% more coins, bigger
wheels add grip, the colour is the paint, and a car listed as damaged arrives at 60%.

Without a car of your own there is a demo line-up, one of each kind, which stays available as
test drives after you add yours.

## Damage, coins, repairs, upgrades

- **Condition (0-100%) stays with the car between runs.** A big hit costs about half of an
  average car (more for a harder crash, at most 70%), scrapes cost a few percent, and tougher
  cars and body armour take less. Every fresh car survives its first big hit; a family sedan is
  wrecked by the second, an off-roader by the third. A damaged car smokes, flashes its hazards,
  darkens and loses power and top speed. Below 10% it will not start until it is repaired.
- **Coins:** about 1 per 20 points in time attack and on the highway, 400 and up for winning a race (more for a big
  margin), something for finishing. Everyone starts with 500.
- **Repairs** cost coins in proportion to the damage (the compact is cheapest, the sports coupe
  dearest); without enough coins you fix what they cover, and a player who is broke with a
  wrecked car gets a free patch-up to 35% so nobody is stuck.
- **Workshop:** six upgrades with five levels each: engine (+7% power a level), gearbox (+5% top
  speed), tires (+5% grip), brakes (+12%), body armour (-9% damage), nitro tank (slower drain,
  more boost at the start). Prices scale with the kind of car.
- When a host page is connected, the workshop also offers "Find a mechanic" and "Parts for this
  car", which ask the host to open its own listings for that car.

Everything is kept in this browser (localStorage), or on the player's account if the host page
stores the progress the game sends it.

## Time attack

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

## Highway

An endless motorway out of town: four lanes each way, a concrete median, guardrails, lamps,
overhead signs and overpasses, with traffic on both sides. There is no clock: drive until you
pause and pick **End drive** (or press E while paused), or until the car is wrecked. Near misses,
drifts, boost, combos and damage work as in time attack, and the HUD shows the distance driven
instead of the time. Ending the drive banks the combo and pays the coins; highway scores have
their own top 10.

Traffic keeps to its lanes at 80-120 km/h (slow lane to fast lane, trucks and buses mostly on
the right), follows the car ahead, and changes lanes with its indicator on to get past slower
cars, sometimes right in front of you. It brakes for you too, with brake lights. It gets denser
the further you go. A car you hit skids to a stop with its hazards on and stays in the way.

It is built well north of the city, out of sight of it, and the city is left as it was while
you are away. The road and scenery repeat every 480 m and follow the car; every 2,880 m the
car, the traffic and the camera are moved back to keep the numbers small for the physics, which
cannot be seen because everything repeats on that length (`src/mygarage/Highway.ts`).

## Race

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
  off-route warnings. Race traffic is a little lighter than time attack.

Turning is helped: every car gets more steering lock at speed and a little more grip, and the
car follows the wheel (when it turns less than the wheel asks, the missing rotation is added
without making it slide). Turns are 15-30% tighter at 50-80 km/h than the raw physics, and the
car settles straight after a flick. Drifts and handbrake turns are left alone.

Controls: W A S D drive, Shift boost, Space + steer to drift, mouse to look, Esc pause,
R restart (in a race: the same route again), T back on the route (race), Enter start.

On phones and tablets (or with `?touch=1`) there are on-screen controls: steering buttons on
the left, gas and brake on the right with boost and drift above them, pause and (in a race)
reset at the bottom. On a phone held upright the garage card moves under the scene and the
Drive button sits over the scene, and holding the phone upright during a run asks you to turn
it. Phones start
on the LOW graphics preset.

It reuses Echo City's city generator, chunk renderer and shaders, sky and weather, Rapier car
physics (with an arcade drift layer that only Near Miss switches on), traffic simulation,
vehicle models and procedural audio. Its own code is in
`src/mygarage/` (about 6,500 lines): the scoring rules (`scoring.ts`, pure and unit-tested),
routes, race progress and the rival's driver (`race.ts`, pure), one race with its rival car and
gates (`RaceSession.ts`), the highway with its traffic (`Highway.ts`), the garage (`garage/`:
archetypes, catalogue, vehicle parsing, the economy, the host bridge and its store, all pure
except the store), the game loop and traffic director (`DriveGame.ts`) and the interface
(`App.tsx`, `RaceUI.tsx`, `GarageUI.tsx`, with the shared pieces in `ui.tsx` and the colours in
`theme.css`). The
ten garage bodies and their physics specs live with the other vehicles (`src/sim/vehicles.ts`
ids 9-18, never used for traffic; `src/render/vehicleModels.ts`).

## Architecture

```
src/
  mygarage/  MyGarage Drive: scoring rules, race, highway, garage, game loop, interface
  core/      seeded RNG, noise, math helpers
  world/     city generator, buildings, names, chunk geometry + worker, terrain
  render/    materials/shaders, chunk manager, sky/lighting, humans, vehicles, rain, terrain
  engine/    World (city + chunks + terrain + collision + sky, shared by both games), input,
             Rapier physics wrapper, procedural Web Audio
  sim/       clock, weather, economy, NPC population + life simulation, pedestrians,
             sidewalk navigation, traffic, dialogue lines, LLM hook
  game/      shared: the drivable car and the camera; the rest is Echo City (Session, player,
             interiors, jobs, dialogue, objectives, business, events, mini-games, saves, menus)
  ui/        Echo City's HUD, minimap, map, phone, menus, settings (the map renderer is shared)
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
npm run test:unit    # scoring (27), drift (40), turning help (6), race rules (13), garage (29)
npm run test:race    # the rival AI racing itself through real physics and traffic (a few minutes)
npm run dev &        # then, in another shell:
npm run test:e2e     # drives MyGarage Drive (and Echo City) in headless Chromium
npm run test:sim     # Echo City: headless 3-day simulation of its residents and economy
```

`scripts/e2e-drive.mjs` (35 checks) covers the title screen with the parked car and garage
card, adding a car with the garage form (a Soueast DX5 drives as a white crossover), buying an
upgrade, picking a car and conditions, the countdown, a scripted near miss, combo banking, boost, oncoming driving, a drift (scored, with
skid marks and smoke), pause, a first crash that damages the car and a second that wrecks it,
the results screen with coins and condition, a wrecked car refusing to start until it is
repaired, repairing it, restart, running out of time (and the coins for it), the rain grip
penalty, and
the race: the grid and both colours, the rival driving off at GO, the race HUD, a crash that
stops the car without ending the race, passing a checkpoint, T back on track, winning, losing
after the rival finishes, a highway drive (70 seconds with no clock, a near miss on a slower
car, a crash into a stopped one, ending the drive for coins and its own best, and the city
coming back afterwards), the high score on the loading screen after a reload, a `#garage=`
host link bringing in the player's cars (a damaged Lada 2107 with gas equipment arrives as a
classic at 60% that earns extra coins), and the touch controls driving the car.
`scripts/garage-test.ts` checks the catalogue against real cars, that every kind of car really is
best at what it claims, the damage rules, the economy, and that hostile host payloads and corrupt
saves are cleaned up.
`scripts/race-test.ts` races two AI cars over six routes through the real city collision and
traffic, and checks that they finish and how fast. `scripts/drift-test.ts` drives each
garage car in Rapier without a browser and checks that drifts hold an angle, keep speed and end
cleanly, and that without the assists the cars still grip. `scripts/handling-test.ts` measures
the turning help: turning radius with and without it at 50 and 80 km/h, slip, settling after a
flick, and that drifting still works. The e2e suite also passes against the production build.

Echo City's own suites are described in [docs/ECHO-CITY.md](docs/ECHO-CITY.md).

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
  container, ~1–2 fps for real frames). Actual frame rates on real GPUs and phones are unknown.
  If it struggles, use MEDIUM or LOW or lower the draw distance.
- **Audio is untested by ear.** It is synthesised with Web Audio and runs without errors, but
  levels and mix were not listened to.
- The JavaScript bundle is large (≈6 MB, ≈2.3 MB gzipped, much of it the Rapier WebAssembly
  module); it is not code-split.
