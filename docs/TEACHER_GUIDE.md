# Teacher guide

**What it is for.** Monopoly is often used to talk about markets, but it starts everyone equal and treats bad luck as a card. This version keeps the Monopoly loop (so everyone already knows how to play) and changes the things that matter in a real economy: where you start, what the state takes and gives back, insurance, and shocks that hit people unequally.

**Running it.** One device per game, 2 to 8 players, humans and computer players mixed. A "Quick" game is about 25 minutes, "Normal" about 40. The game saves itself in the browser, so a lesson can stop and continue later. Leave "Explain things the first time they happen" on for a first game.

**Suggested lesson (one period).**
1. Five minutes: play ordinary Monopoly in your head. Ask: what does everyone start with? What decides who wins?
2. Thirty minutes: play. Encourage trades. Read the "In the real world" notes aloud when they come up.
3. Ten minutes: the results screen. Who earned most from working? From owning? Who paid the biggest share in tax? Who went to Hospital and what did it cost them?

**The five starts.** Old Money, Upper-middle class, Professional, Working class, Working poor. With 4 players the Professional is left out; with 3, Old Money, Working class and Working poor; with 2, Old Money and Working poor. In simulations Old Money finishes richest almost every time. That is the lesson, so the game also crowns a Best climber: the player who grew most from their own starting line, which anyone can win.

**Things to point at.**
- Old Money pays estate tax on day one and still finishes richest almost every game. Ask why. Then ask who climbed most, and what they had.
- Living costs: the Working poor spend most of their pay just to live; Old Money spends more in dollars but a small share of income. Ask what "left over" means for each.
- The Working poor have no insurance. Watch what a Life card does to them compared with the Nurse.
- Payday: the Professional earns the most salary and pays the highest rate. Old Money's income is mostly trust, investments and rent. Ask whether that is fair, and whether it is true in your country.
- World cards: a recession lowers everyone's rent, but only hurts those who depend on it. A stock crash costs the rich real money and the poor nothing.
- Loans: Old Money borrows $500,000 at 5%. The Working poor borrow $30,000 from a payday lender at 25%. Watch who borrows their way out of trouble and who has to mortgage or sell. Ask who gets cheap credit in the real world.
- Auctions: when someone passes, the property goes to the highest bidder. Who wins auctions? Who can afford to bid at all?
- Wealth Tax square: most players pay nothing. Ask whether a tax that only the rich pay is fair, and why so few countries have one.

**Changing the numbers.** Everything is in `js/data.js`: starting backgrounds, tax bands, card effects, prices. Change a country's rates and play again.

**Limits.** Dice decide where you land; real life has more choice and more constraint. Prices are Monopoly ratios scaled to dollars, not a real city. Computer players are simple.
