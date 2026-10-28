# Cooldown: the pause button for impulse buys

> **Cool down before you check out.**

Cooldown is a mobile app and browser extension that steps in at the moment of checkout. It shows what a purchase really costs: hours of your work, and days added to your savings goal. One tap puts the item on a 24-hour cooldown. If you still want it tomorrow, buy it guilt-free. If you don't, the money moves straight into your savings.

---

## 1. Problem

Shopping has lost its friction. Social feeds sell, checkout takes one tap, and "pay in 4" hides the price. Most budgeting tools only look backwards: they sort your spending into categories *after* the money is gone. Nothing protects the moment that matters, which is checkout at 1 a.m.

| Signal | Data | Source |
|---|---|---|
| Social media drives impulse buying | 60% of Gen Z (and 61% of millennials) impulse-shopped because of social media in the past year; Americans spent ~$71B this way | Bankrate survey, 2023 |
| People regret it | 62% of consumers regretted an impulse purchase; 34% said it caused financial stress | PartnerCentric survey, reported by Retail Brew, May 2026 |
| BNPL adds debt | 39% of Gen Z BNPL users have paid late | Motley Fool Money BNPL Trends Study, 2025 |
| Impulse buys come back | US retail returns hit ~$890B in 2024, 16.9% of sales | NRF & Happy Returns, 2024 |
| The category is growing | Budget apps: ~$1.9B (2025) → ~$4.8B (2033), 12.4% CAGR | Verified Market Research |

*These are US surveys and estimates vary by method, so treat them as direction, not precision. Add local (EU) data if your market is Europe.*

## 2. Solution: how it works

1. **Set up in 2 minutes:** add your hourly pay (or monthly income) and a goal, e.g. *Tokyo trip, €2,000*. Optionally connect your bank (read-only, via open banking).
2. **Cooldown steps in at checkout:** a browser/Safari extension spots checkout pages, and a "Cool down this" share button works from any shopping app.
3. **The real price:** *€68 hoodie = 5h 40m of your shift = +3 days to Tokyo.*
4. **24-hour cooldown:** one tap holds the item. Tomorrow you get one question: *"Still want it?"*
5. **Unspend:** say "Nah" and the €68 moves to your goal automatically. Say "Yes" and you buy it guilt-free, because you decided with a cool head.
6. **Wins you can share:** a monthly "unspent" total, streaks and story-ready share cards (#UnspentChallenge).

**Why it works:** it uses well-known behavioural ideas. The *hot–cold empathy gap* says we decide differently when we're "hot" (excited, tired, scrolling at 1 a.m.) than when we're calm, which is where the name comes from. Translating euros into *hours of work* restores the "pain of paying" that one-tap checkout removed. EU law already gives online shoppers a 14-day right of withdrawal *after* buying. Cooldown moves the cooling-off period to *before* you pay.

## 3. Target customer

- **Primary:** 18–30 year-olds (Gen Z and young millennials) who shop through social apps, use BNPL, and have tight or irregular income: students, first jobs, part-time workers.
- **Persona:** *Maya, 22, part-time barista at €12/h, saving for Tokyo. Her TikTok For You page is half hauls.*
- **Secondary:** anyone doing a no-buy month or "underconsumption" challenge, and parents who want guard-rails for teens.

## 4. Competition and differentiation

| | Tracks spending after the fact | Intervenes **before** you pay | Auto-saves what you skip | Built to be shared |
|---|---|---|---|---|
| Budget trackers (e.g. YNAB, Emma) | ✓ | — | — | — |
| Neobank savings features (e.g. round-ups, pots) | ✓ | — | partly (round-ups) | — |
| AI money chatbots (e.g. Cleo) | ✓ | — | partly | partly |
| **Cooldown** | light | **✓** | **✓** | **✓** |

The moat is owning the *moment of decision* rather than the spreadsheet afterwards, plus a social loop where "what I didn't buy" becomes content.

## 5. Business model

| Stream | What | Price / logic |
|---|---|---|
| **Free** | Cooldown timer, real price, 1 goal | Acquisition |
| **Cooldown Plus** | Auto-save to goals, unlimited goals, card + browser integrations, custom rules (e.g. "only after 22:00", "only over €30"), insights | €3.99/month or €29.99/year |
| **B2B2C** | White-label "Cooldown inside" for banks/neobanks; employer financial-wellbeing benefit | Per-active-user licence |
| **Later: "Verified Want"** | Opt-in: retailers reward items you *still* want after cooldown, a hypothesis to test for lower return rates | Commission. Never ranks or pushes products. |

*Illustrative, not a forecast:* 200k monthly users × 5% paid × €3.99 × 12 ≈ **€480k ARR** from subscriptions alone, before B2B.

## 6. Go-to-market

- **TikTok-first:** the launch video, the **#UnspentChallenge** ("show what you *didn't* buy" instead of a haul), and partnerships with #MoneyTok creators.
- **Waitlist with referrals:** invite friends to skip the line. Comment ❄️ for early access.
- **Campus ambassadors**, plus pilots with one neobank and one employer.
- **KPIs:** waitlist sign-ups, cooldown → skip rate, € unspent per user per month, D30 retention, free → Plus conversion.

## 7. Roadmap

| Phase | Scope |
|---|---|
| MVP (0–3 months) | iOS/Android app, Chrome + Safari extension, share-sheet, manual goals, real-price engine |
| V1 (3–9 months) | Open-banking read + auto-save via a licensed partner, streaks, share cards |
| V2 (9–18 months) | Cooldown virtual card, bank white-label, Verified Want pilot |

## 8. Risks and how we handle them

- **Users switch it off:** it's one tap, fun and rule-based ("late-night mode"), and you can always override. It's a speed bump, not a wall.
- **Mobile platforms limit interception:** use the share-sheet, Safari web extension and (V2) the virtual card, which works everywhere.
- **Regulation and data:** open-banking access goes through a licensed AISP/PISP partner (PSD2), GDPR-first, read-only by default.
- **Conflict of interest with retailer revenue:** strictly opt-in and clearly labelled. Cooldown never recommends products.
