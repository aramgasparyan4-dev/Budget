# Real Estate Capital

Monopoly, except nobody starts equal. A browser board game for classrooms: spin a wheel to find out who you are (an heir, a nurse, a graduate with debt), then play a familiar Monopoly loop with the real world bolted on: income tax at payday, property and wealth tax squares, health insurance, a Hospital instead of jail, Life cards that hit one player and World cards that hit everyone. The game explains each thing the first time it happens and ends with a screen showing who earned what from working, who earned from owning, and who paid what in tax.

No build step. Open `index.html` in any browser. Play on one device (pass it around) with any mix of people and computer players.

**Hosting for a class (GitHub Pages).** The repository has a workflow that publishes the game on every push to `main`. One-time setup: Settings → Pages → Source: "GitHub Actions". The game then lives at `https://<user>.github.io/<repo>/`.

## How it plays

1. **Spin the wheel.** Eight starts in life, dealt at random: Heir, Business Owner, Software Engineer, Nurse, Construction Worker, Graduate, Retiree, Small Landlord. Each has its own cash, salary, insurance, inherited property or debt, and an "in the real world" note.
2. **Monopoly.** Roll, buy, pay rent, complete colour groups, build houses and hotels, mortgage, trade. Doubles roll again; three doubles sends you to Hospital.
3. **One lap is a year.** Pass Payday to collect your salary, minus progressive income tax (10% to 40%), minus health insurance if you have it, minus student loan repayments.
4. **Squares with a lesson.** Property Tax (1% of what you own), Wealth Tax (2% of net worth above $1M), Hospital (pay the bill or roll doubles; $40,000 uninsured, $4,000 insured), Accident (go to Hospital).
5. **Life cards** (medical emergency, layoff, promotion, baby, lawsuit, repairs) and **World cards** (recession, boom, rate hike, pandemic, hurricane, housing boom or crash, tax cut or rise, rent control, stock crash, minimum wage, wealth tax).
6. **Win** with the highest net worth when the rounds run out. Run out of cash and assets and you are bankrupt.

Every mechanic that is new compared with Monopoly is explained in a box the first time it happens to a human player (toggle on the setup screen). The end-of-game screen shows the ranking, a net-worth chart, income from working versus rent, taxes and medical bills, a few facts the game noticed, and discussion questions.

## Files

- `index.html`, `css/style.css`: the page.
- `js/data.js`: board, wheel backgrounds, cards, tax rules, explanations. All tuning lives here.
- `js/engine.js`: the game as a state machine (`state` + `dispatch(action)`), no DOM, deterministic by seed. Ready for online play by room code: a host can run it and relay actions.
- `js/ai.js`: computer players.
- `js/ui.js`: board, wheel, action card, trades, results.
- `tests/sim.js`: headless all-computer games for balance. `node tests/sim.js [games] [rounds] [seed] [-v]`.
- `docs/TEACHER_GUIDE.md`: using it in a lesson.
