# MyGarage Drive: plugging it into a garage

How a site with a "My Garage" feature (saved vehicles per user, as on list.am) can let its users
drive their own cars in the game. Everything here is implemented in
`src/nearmiss/garage/bridge.ts` and covered by `scripts/garage-test.ts` and the e2e suite.

## 1. Embed

Host the built game (`npm run build`, then `dist/near-miss.html` and `dist/assets/`) on any
origin and show it in an iframe, or link to it. Build with the host's origins allowed:

```bash
VITE_GARAGE_ORIGINS=https://www.list.am,https://list.am npm run build
```

Only those origins (and the game's own) can send it vehicles, and the game only ever posts
back to the origin that sent them.

## 2. Hand over the vehicles

Either way works; both carry the same JSON.

**A link** (no code on the host page): put the payload, base64url-encoded UTF-8 JSON, in the
fragment. The fragment never reaches the game's server.

```
https://game.example/near-miss.html#garage=eyJ2ZWhpY2xlcyI6W3siaWQiOiIxMjMiLCJtYWtlIjoiU291ZWFzdCIsIm1vZGVsIjoiRFg1IiwieWVhciI6MjAyNH1dfQ
```

**postMessage** (for an iframe, and to keep progress on the account): when the game loads it
posts `{ type: 'nearmiss:ready', version: 1 }` to the parent; answer with

```js
iframe.contentWindow.postMessage({ type: 'garage:vehicles', vehicles, progress }, 'https://game.example');
```

### Payload

```ts
{
  vehicles: Array<{
    id: string;            // the garage's own id for the car (kept as the save key when there is no VIN)
    make: string;          // required, e.g. "Soueast"
    model: string;         // required, e.g. "DX5"
    year?: number;         // 1940-2035
    vin?: string;          // progress follows the VIN when there is one
    color?: string;        // the garage's colour name ("White", "Черный"...) or "#rrggbb"
    condition?: string;    // "Not damaged" | "Damaged"
    engine?: string;       // "Gasoline" | "Diesel" | "Hybrid" | "Electric" | "Gas" (LPG/CNG)
    gasEquipment?: boolean | string;
    steeringWheel?: string; // "Left" | "Right"
    wheelSize?: number | string; // 18 or "R18"
    headlights?: string;   // "Halogen" | "Xenon" | "LED"
    sunroof?: boolean | string;
    primary?: boolean;     // the car to select first
    archetype?: string;    // optional override: compact sedan exec sports hatch crossover offroad utility ev classic
  }>;
  progress?: GarageSave;   // what the game sent last time (below), to continue where they left off
}
```

The values are the Garage form's own option labels; the game normalises them (case, English and
Russian spellings). Unknown fields are dropped, strings are capped at 40 characters and stripped
of markup, at most 10 vehicles are read, and out-of-range numbers are ignored, so the host can
pass its records as they are.

## 3. Events the game sends

All are posted to the host origin only.

| `type` | When | Fields |
| --- | --- | --- |
| `nearmiss:ready` | page loaded | `version` |
| `nearmiss:progress` | after every change (run, repair, upgrade, car added) | `save`: coins, per-car condition and upgrades |
| `nearmiss:run` | a run or race ended | `vehicleId`, `mode`, `score`, `coins`, `health`, `won?` |
| `nearmiss:parts` | "Shop real parts that fit this car" in the workshop | `vehicleId`, `make`, `model`, `year`, `category` |
| `nearmiss:services` | "Find a real mechanic" when the car is damaged | `vehicleId`, `make`, `model`, `year`, `category: 'repair'` |

`parts` and `services` are the hooks back into the site: open the compatible-parts search or
the repair services listing for that exact car. The two buttons only appear once a host has
connected by postMessage.

## 4. Things to decide on the host side

- **Where progress lives.** By default it is in the browser (localStorage). Storing
  `nearmiss:progress` on the account and passing it back as `progress` makes it follow the user
  across devices.
- **Rewards.** Coins are client-side and can be edited in the browser. Fine for an in-game
  economy; if they are ever exchanged for something real (bonus points, discounts), score the
  runs on the server instead of trusting `nearmiss:run`.
- **Body types.** If the garage's catalogue has a body type per model, sending `archetype`
  directly is more accurate than the game's own make/model matching.
- **Branding.** The game page has no host branding; add it in the host's frame around it.
