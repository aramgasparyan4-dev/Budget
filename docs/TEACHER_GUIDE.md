# Teacher guide

**What it is for.** Monopoly is often used to talk about markets, but it starts everyone equal and treats bad luck as a card. This version keeps the Monopoly loop (so everyone already knows how to play) and changes the things that matter in a real economy: where you start, what the state takes and gives back, insurance, and shocks that hit people unequally.

**Running it.** One device per game, 2 to 8 players, humans and computer players mixed. A "Quick" game is about 25 minutes, "Normal" about 40. The game saves itself in the browser, so a lesson can stop and continue later. Leave "Explain things the first time they happen" on for a first game.

**Suggested lesson (one period).**
1. Five minutes: play ordinary Monopoly in your head. Ask: what does everyone start with? What decides who wins?
2. Thirty minutes: play. Encourage trades. Read the "In the real world" notes aloud when they come up.
3. Ten minutes: the results screen. Who earned most from working? From owning? Who paid the biggest share in tax? Who went to Hospital and what did it cost them?

**Things to point at.**
- The Heir pays estate tax on day one and still wins most games. Ask why.
- The Graduate and the Construction Worker have no insurance. Watch what a Life card does to them compared with the Nurse.
- Payday: the Engineer earns the most and pays the highest rate. The Heir earns little salary but most of their income is rent, which this game does not tax. Ask whether that is fair, and whether it is true in your country.
- World cards: a recession lowers everyone's rent, but only hurts those who depend on it. A stock crash costs the rich real money and the poor nothing.
- Bank loans: the Heir can borrow $400,000 at the same 10% as the Graduate's $20,000. Watch who borrows their way out of trouble and who has to mortgage or sell. Ask who gets cheap credit in the real world.
- Auctions: when someone passes, the property goes to the highest bidder. Who wins auctions? Who can afford to bid at all?
- Wealth Tax square: most players pay nothing. Ask whether a tax that only the rich pay is fair, and why so few countries have one.

**Changing the numbers.** Everything is in `js/data.js`: starting backgrounds, tax bands, card effects, prices. Change a country's rates and play again.

**Limits.** Dice decide where you land; real life has more choice and more constraint. Prices are Monopoly ratios scaled to dollars, not a real city. Computer players are simple.
