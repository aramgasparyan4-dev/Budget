# Teacher guide: Real Estate Capital

A board game for ages roughly 13 and up that lets students feel how a market economy treats people differently depending on where they start, what the government does, and what happens to them along the way. One game of 3 to 5 years takes 20 to 40 minutes.

## Setting it up in class

- **One screen, several students (hot-seat).** Add 2 to 4 human players. The game asks players to pass the device at the start of each turn. Works on a projector with students calling out decisions.
- **One student per device.** Each student plays against computer opponents. Set the same scenario and policy for the whole class, then compare results.
- **Classroom mode** (checkbox at setup) removes the casino and gambling events, divorce, and the lottery. Everything else stays: medical bills, layoffs, estate tax, foreclosures.
- **Game length**: 3 years is enough for one lesson. 5 years shows more cycles and more tax seasons.
- The game saves itself in the browser. Students can continue next lesson on the same device and browser.

## The scenarios and what each teaches

| Scenario | What happens | Question it raises |
|---|---|---|
| Normal times | Random backgrounds, a growing economy | How much does the start decide the end? |
| Everyone equal | All players start as a middle manager with $100k | Is the outcome still unequal? Why? (Luck, dice, events, decisions.) |
| Born lucky, born unlucky | An heir, a graduate with student debt, an uninsured construction worker, a nurse | Who can take risks? Who is one accident away from trouble? |
| Crash on day one | Deep recession and a housing bust from the first month | Who survives a crisis? Who buys cheap while others are forced to sell? |
| High inflation | Prices rising 6% a year, rates going up | Who wins from inflation (owners, borrowers) and who loses (savers, renters)? |

## The policy settings

Policy changes what the government does. Running the same scenario twice with different policies is the strongest lesson in the game.

- **Balanced**: moderate taxes, unemployment at 40% for 6 months, private health insurance.
- **Strong safety net**: taxes 30% higher, public health insurance for everyone, unemployment at 70% for a year, 30% estate tax on inheritances over $1M.
- **Low tax, no net**: taxes 30% lower, no unemployment benefit, no estate tax, insurance 30% dearer.

Suggested comparison: play "Born lucky, born unlucky" under "Low tax, no net", then again under "Strong safety net". Look at the end-of-game screen: who paid what, who went bankrupt, how wide the gap is.

## Mechanics mapped to real-world ideas

| In the game | In the world |
|---|---|
| Backgrounds with different cash, property, debt, insurance | Inherited wealth and inequality of starting points |
| Houses on a property (up to three) | Investing in an asset to raise its income |
| Estate tax on inherited buildings | Inheritance tax debates |
| One live price for every building | Asset markets, appreciation, bubbles |
| Mortgages at 80% loan-to-value | Leverage: borrowed money multiplies gains and losses |
| Credit line at 20%+ when cash runs out | Credit cards, payday loans, debt traps |
| Foreclosure and bankruptcy | What happens when debts cannot be paid |
| Progressive income tax, lower capital gains tax | Why income from work is often taxed more than income from wealth |
| Property tax, wealth tax event | Different ways to tax wealth |
| Recessions, booms, rate hikes, rate cuts | The business cycle and central banks |
| Pandemic, hurricane, oil shock, factory closures | Shocks that hit some people far harder than others |
| Rent control, transit lines, flood maps | Policy and infrastructure changing who gains |
| Medical emergencies, deductibles, out-of-pocket caps | Health insurance design, medical bankruptcy |
| Layoffs, unemployment benefit | The safety net, or lack of one |
| Retirement at 67 on a 45% pension | Pensions and planning for old age |

Every global event shows an "In the real world" note on the News tab with a historical example (2008, 2020, 1973, Katrina, Detroit).

## The end-of-game screen

When time runs out, the game shows:

1. The ranking, with what each player started with and finished with.
2. A chart of every player's net worth over the whole game.
3. Where each player's money came from: working, owning buildings, investing and price rises; and what they paid in tax and medical bills.
4. A few facts the game noticed (gap at start vs end, who paid what share in tax, who made more from owning than working).
5. Discussion questions.

## Discussion questions

- Who worked the most? Who ended richest? Are those the same people?
- What could the poorest player have done differently? What could they not have changed?
- Which events hurt everyone and which hurt only some people? Why?
- The heir paid the most tax in dollars. Did they pay the highest share of their income? Why not?
- Under "Low tax, no net", what happened to anyone who had a medical emergency without insurance?
- Rents rose when the transit line opened. Who paid for the line? Who gained from it?
- Would you rather start as the engineer with no property and a high salary, or the small landlord with two mortgaged buildings and a low salary? Why?
- Is the game fair? Is the real economy?

## Vocabulary

The "Words to know" list (Help button, then "Words to know") defines net worth, cash flow, mortgage, equity, leverage, interest rate, inflation, recession, rent yield, occupancy, capital gain, progressive tax, estate tax, deductible, credit score, foreclosure, bankruptcy, index fund, appreciation and safety net.

## Changing the numbers

All rules live in plain text in `js/data.js`: tax bands, property prices, event probabilities, backgrounds, policies, scenarios, glossary. Teachers who want a local version (local currency, local tax rates, a different city) can edit that one file.

## Limits, so students are not misled

- It is a model with made-up numbers in a made-up city. Prices, rents and tax bands are plausible for a mid-sized rich-world city, not any real place.
- Dice decide where you land; real life has more choice and more constraint than that.
- The computer players use simple rules. They are not clever investors.
- The game cannot show everything: there is no stock-picking, no business building, no education investment, no housing for the player themselves.
