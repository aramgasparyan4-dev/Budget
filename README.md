# Real Estate Capital

A browser board game in the Monopoly family, built to feel like the real world instead of a fair race. Players start with wildly different hands, trade in one open market, pay taxes, carry mortgages, get hit by recessions and hurricanes, and occasionally end up in the hospital.

No build step. Open `index.html` in a browser (or serve the folder with any static server).

## Playing

1. Add 2 to 6 players. Any mix of humans (hot-seat on one device) and computer opponents.
2. Pick the game length (3 to 20 years), computer speed, and optionally the "Everyone starts equal" mode.
3. On your turn: look around if you want (Overview, My buildings, Market, Bank, News), **Roll the dice**, deal with whatever you land on, do more business, then **End turn**. The right-hand panel always shows the one button you need next and a feed of what happened.
4. One full round of turns is one month. Every month settles salary, rent, mortgage payments, upkeep, property tax, insurance premiums and interest. Every December the income tax bill is due and an annual report is shown.
5. The game ends when time runs out or only one player is left solvent. Highest net worth wins.

The game autosaves at the start of each human turn (browser local storage). Use **Save** / **Menu** to leave and **Continue saved game** to come back.

## What is in the simulation

**Unequal starts.** Each player is dealt a background: Trust-Fund Heir (inherits a downtown tower and a waterfront building, both mortgaged, and owes estate tax), Family Business Owner, Software Engineer (student loan), Nurse, Construction Worker (no health insurance), Recent Graduate, Retiree (pension, 66 years old), Small Landlord (two leveraged rentals). Cash, salary, age, health, credit score, children and debts all differ.

**One market.** 28 properties in 7 districts, each with a live value driven by the property index, district modifiers, condition, renovations and whether one owner holds the whole district. Unowned buildings can be bought when landed on (market value) or at any time off-market (5% premium). Owners can list buildings at any price, and anyone can make an offer on anything; computer players accept or decline based on their situation. A quick sale to a cash buyer at 80% of value is always available.

**Financing.** Mortgages up to 80% loan-to-value, 30-year fixed, rate depends on the central bank rate and your credit score. Cash-out refinancing, rate refinancing, prepayment. Personal loans. An automatic credit line at a painful rate when cash goes negative. Exhaust the credit line and your stocks and then your buildings are seized.

**Property management.** Buildings lose condition every month (faster in student housing and Old Town). Low condition cuts occupancy and value and brings code violation fines. Repair, renovate (three levels), insure against disasters, and set rent policy (low rent for occupancy, high rent for yield). Landing on someone's building costs a month of rent. Owning a whole district gives +25% rent and +10% value.

**Taxes.** Progressive income tax (10/20/32/40% brackets, standard deduction, rental expenses and mortgage interest deductible), 1.1% annual property tax, 20% capital gains tax on sales profits, estate tax on inheritances over $1M, random audits, occasional wealth tax legislation.

**Economy.** A business cycle (expansion, peak, recession, recovery) with a property index, a stock index fund you can invest in, a central bank rate that follows inflation, and inflation that raises salaries and living costs each year.

**Global events.** Recession, boom, rate hikes and cuts, pandemic, hurricane, earthquake, tech boom, factory closures, university expansion, rent control, tax hikes and cuts, inflation surge, housing bubble (and the crash after it), stock crash, infrastructure bill, crime wave, insurance crisis, oil shock, wealth tax, new transit line, flood zone remap, population boom.

**Life.** Health declines with age and stress and recovers with insurance, check-ups and vacations. Medical emergencies range from a flu to cancer treatment; without insurance you pay the whole bill, with insurance you pay a deductible and coinsurance up to an annual cap. Serious cases put you in hospital for months with reduced or no pay. Layoffs, promotions, job offers, children, divorce, friends asking for loans, a stock tip, a food truck partnership. Retirement at 67 on a 45% pension. Health at zero is the end.

## Files

- `index.html`, `css/style.css`: the page.
- `js/data.js`: board, districts, backgrounds, events, tax and cost constants. Tune the game here.
- `js/engine.js`: the simulation. No DOM; usable from Node.
- `js/ai.js`: heuristic computer players.
- `js/ui.js`: board rendering, tabs, modals, human controller.
- `tests/sim.js`: headless all-AI simulation. `node tests/sim.js [games] [years] [seed] [-v]`.
