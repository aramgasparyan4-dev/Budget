/* Real Estate Capital v2 — data. A Monopoly loop with real-world twists. One lap = one year. */
(function (g) {
  'use strict';
  const K = 1000;

  const GROUPS = {
    oldtown:    { name: 'Old Town',     color: '#955436' },
    riverside:  { name: 'Riverside',    color: '#aae0fa', dark: true },
    suburbs:    { name: 'Suburbs',      color: '#d93a96' },
    university: { name: 'University',   color: '#f7941d' },
    midtown:    { name: 'Midtown',      color: '#ed1b24' },
    techpark:   { name: 'Tech Park',    color: '#fef200', dark: true },
    waterfront: { name: 'Waterfront',   color: '#1fb25a' },
    downtown:   { name: 'Downtown',     color: '#0072bb' },
    transport:  { name: 'Transport',    color: '#222222' },
  };

  // Monopoly ratios, realistic magnitudes (x1000). rents: [base, 1 house, 2, 3, 4, hotel]
  const P = (name, group, price, rents, house) => ({ kind: 'property', name, group, price: price * K, rents: rents.map(r => r * K / 2), house: house * K / 2 });
  const T = (name) => ({ kind: 'property', name, group: 'transport', price: 200 * K, rents: [12 * K, 25 * K, 50 * K, 100 * K], house: 0 });
  const S = (kind, name, icon) => ({ kind, name, icon });

  const BOARD = [
    S('go', 'Payday', '💵'),
    P('Mill Street Rowhouse', 'oldtown', 60, [2, 10, 30, 90, 160, 250], 50),
    S('world', 'World', '🌍'),
    P('Cannery Lofts', 'oldtown', 60, [4, 20, 60, 180, 320, 450], 50),
    S('tax', 'Property Tax', '🧾'),
    T('Airport'),
    P('Elm Street Homes', 'riverside', 100, [6, 30, 90, 270, 400, 550], 50),
    S('life', 'Life', '🎴'),
    P('Oak Avenue Duplex', 'riverside', 100, [6, 30, 90, 270, 400, 550], 50),
    P('Willow Court', 'riverside', 120, [8, 40, 100, 300, 450, 600], 50),
    S('hospital', 'Hospital', '🏥'),
    P('Maple Court', 'suburbs', 140, [10, 50, 150, 450, 625, 750], 100),
    S('life', 'Life', '🎴'),
    P('Cedar Hills', 'suburbs', 140, [10, 50, 150, 450, 625, 750], 100),
    P('Birch Lane', 'suburbs', 160, [12, 60, 180, 500, 700, 900], 100),
    T('Rail Depot'),
    P('Campus View', 'university', 180, [14, 70, 200, 550, 750, 950], 100),
    S('world', 'World', '🌍'),
    P('Scholars Hall', 'university', 180, [14, 70, 200, 550, 750, 950], 100),
    P('Dormitory Row', 'university', 200, [16, 80, 220, 600, 800, 1000], 100),
    S('dayoff', 'Day Off', '🌴'),
    P('Metro Plaza', 'midtown', 220, [18, 90, 250, 700, 875, 1050], 150),
    S('life', 'Life', '🎴'),
    P('Grand Avenue', 'midtown', 220, [18, 90, 250, 700, 875, 1050], 150),
    P('Theater Tower', 'midtown', 240, [20, 100, 300, 750, 925, 1100], 150),
    T('Port'),
    P('Innovation Hub', 'techpark', 260, [22, 110, 330, 800, 975, 1150], 150),
    P('Data Center', 'techpark', 260, [22, 110, 330, 800, 975, 1150], 150),
    S('world', 'World', '🌍'),
    P('Startup Row', 'techpark', 280, [24, 120, 360, 850, 1025, 1200], 150),
    S('accident', 'Accident!', '🚑'),
    P('Marina Condos', 'waterfront', 300, [26, 130, 390, 900, 1100, 1275], 200),
    P('Lighthouse Villas', 'waterfront', 300, [26, 130, 390, 900, 1100, 1275], 200),
    S('world', 'World', '🌍'),
    P('Bayview Towers', 'waterfront', 320, [28, 150, 450, 1000, 1200, 1400], 200),
    T('Bus Company'),
    S('life', 'Life', '🎴'),
    P('Skyline Plaza', 'downtown', 350, [35, 175, 500, 1100, 1300, 1500], 200),
    S('wealth', 'Wealth Tax', '💎'),
    P('One Monarch Tower', 'downtown', 400, [50, 200, 600, 1400, 1700, 2000], 200),
  ];

  /* The wheel. One spin decides where you start in life. Five tiers, one per player. */
  const BACKGROUNDS = [
    { id: 'oldmoney', short: 'Old Money', title: 'Old Money', icon: '👑', cash: 400 * K, salary: 40 * K, living: 70 * K, insured: true, credit: 500 * K, loanRate: 0.05,
      inherit: ['downtown', 'waterfront', 'waterfront', 'techpark', 'midtown', 'transport'],
      trust: 80 * K, invest: 200 * K, family: 150 * K,
      desc: 'A quarter of the board, a family trust, cheap credit.',
      real: 'In the US about 60% of the wealth of the richest families is inherited. Inheritance is the biggest single predictor of ending up wealthy.' },
    { id: 'upper', short: 'Upper-middle', title: 'Upper-middle class', icon: '🏡', cash: 450 * K, salary: 140 * K, living: 45 * K, insured: true, credit: 300 * K, loanRate: 0.10,
      inherit: ['suburbs'], invest: 100 * K, family: 50 * K,
      desc: 'A house, some investments, parents who can help once.',
      real: 'Family help with a deposit, a wedding or a bad year is the quiet advantage of the professional middle class.' },
    { id: 'professional', short: 'Professional', title: 'Professional', icon: '💻', cash: 60 * K, salary: 170 * K, living: 36 * K, insured: true, credit: 150 * K, loanRate: 0.10,
      debt: 60 * K,
      desc: 'Big salary, student debt, no property.',
      real: 'High earners with no assets pay the top income tax rates while asset owners pay lower rates on rent and gains.' },
    { id: 'working', short: 'Working class', title: 'Working class', icon: '🔧', cash: 20 * K, salary: 70 * K, living: 24 * K, insured: true, credit: 50 * K, loanRate: 0.10,
      inherit: ['riverside'], mortgaged: true,
      desc: 'Modest pay, a mortgaged home, insurance from work.',
      real: 'Most people in rich countries live like this: one paycheck at a time, one accident from trouble.' },
    { id: 'poor', short: 'Working poor', title: 'Working poor', icon: '🧹', cash: 5 * K, salary: 48 * K, living: 18 * K, insured: false, credit: 30 * K, loanRate: 0.25, unstable: true,
      debt: 12 * K,
      desc: 'No savings, no insurance, debt at 25%, unstable hours.',
      real: 'About 26 million Americans have no health insurance. Medical bills are the top cause of personal bankruptcy there.' },
  ];

  const TAX = {
    brackets: [[50 * K, 0.10], [100 * K, 0.20], [200 * K, 0.30], [Infinity, 0.40]],
    propertyTaxRate: 0.01, propertyTaxMin: 2 * K,
    wealthTaxRate: 0.02, wealthTaxThreshold: 1000 * K,
    estateExemption: 500 * K, estateRate: 0.20,
  };
  const COSTS = { investReturn: 0.06, freshStart: 10 * K, premium: 8 * K, hospitalBill: 40 * K, hospitalBillInsured: 4 * K, unemployment: 20 * K, loanStep: 10 * K, loanRate: 0.10, auctionStep: 10 * K };

  /* Life cards: happen to one player. */
  const LIFE = [
    { id: 'er', title: 'Medical emergency', text: 'Chest pains at work. Ambulance, scans, three nights in Hospital.', hospital: true, real: 'An ER visit plus a short stay costs $20,000 to $60,000 in the US. Insurance turns that into a few thousand.' },
    { id: 'crash', title: 'Car accident', text: 'Nobody hurt, but the car is wrecked and the other driver is suing.', cash: -12 * K, insuredCash: -2 * K, real: 'Insurance spreads a rare, huge cost over many people paying a small, regular one.' },
    { id: 'promotion', title: 'Promotion', text: 'Your boss finally noticed. Salary up 15% from your next payday.', salaryPct: 0.15, real: 'Raises compound: a 15% raise at 30 is worth hundreds of thousands over a career.' },
    { id: 'layoff', title: 'Laid off', text: 'Your company "restructures". Next payday you get unemployment benefit instead of salary.', laidOff: true, real: 'Unemployment benefit replaces 30 to 70% of pay depending on the country. Savings decide whether a layoff is a scare or a disaster.' },
    { id: 'inherit', title: 'Small inheritance', text: 'A great-aunt leaves you $50,000.', cash: 50 * K, real: 'Below $500,000 there is no estate tax in this game. Most countries exempt small inheritances.' },
    { id: 'baby', title: 'New baby', text: 'Congratulations. Hospital, crib, car seat, and a lot less sleep.', cash: -15 * K, insuredCash: -5 * K, real: 'Giving birth costs around $3,000 with insurance and $15,000 to $20,000 without in the US.' },
    { id: 'refund', title: 'Tax refund', text: 'You overpaid last year. The government sends it back.', cash: 8 * K },
    { id: 'burglary', title: 'Burglary', text: 'Laptop, bike and your grandmother\'s ring are gone.', cash: -6 * K, insuredCash: -1 * K },
    { id: 'wedding', title: 'Your wedding', text: 'A beautiful day. The bill arrives on Monday.', cash: -20 * K, real: 'The average US wedding costs about $30,000. Many couples start married life in debt.' },
    { id: 'lawsuit', title: 'Lawsuit', text: 'A tenant slipped on your steps, or a neighbour says you did. Lawyers either way.', cash: -25 * K, insuredCash: -5 * K },
    { id: 'sidegig', title: 'Side gig', text: 'Weekend work paid off.', cash: 10 * K },
    { id: 'lottery', title: 'Scratch card', text: 'Against all odds, it pays.', cash: 30 * K, real: 'Lotteries take in far more than they pay out. People on low incomes spend the biggest share of their pay on them.' },
    { id: 'repairs', title: 'Building repairs', text: 'Roofs leak, boilers die. Pay $10,000 per house and $40,000 per hotel you own.', repairs: [10 * K, 40 * K], real: 'Owning buildings means paying to keep them standing. Neglect them and tenants leave.' },
    { id: 'rentup', title: 'Rent increase', text: 'Your landlord raises the rent. If you own no property, you pay $10,000 more this year. If you own property, you are the landlord.', renterCost: 10 * K, real: 'Renters pay rising rents to owners. Owners collect them. The same housing market moves money in one direction.' },
    { id: 'hourscut', title: 'Hours cut', text: 'Your employer cuts your hours. Lose $8,000, or nothing if you are self-employed with property income.', cash: -8 * K, real: 'Hourly and gig workers absorb downturns first; salaried staff and owners feel them last.' },
    { id: 'identity', title: 'Identity theft', text: 'Someone opened cards in your name. The bank refunds most of it.', cash: -8 * K },
    { id: 'payday', title: 'Bonus trip', text: 'Advance to Payday and collect your salary.', goto: 0 },
    { id: 'course', title: 'Night school', text: 'You pay $10,000 for a certification. Salary up 10%.', cash: -10 * K, salaryPct: 0.10, real: 'Education usually pays back, but only for people who can afford the fee up front.' },
  ];

  /* World cards: happen to everyone, not equally. */
  const WORLD = [
    { id: 'recession', title: 'Recession', text: 'The economy shrinks. Rents fall 25% for the next 8 rounds and everyone\'s next payday is 20% smaller.', rentMult: 0.75, rounds: 8, salaryNext: 0.8, real: 'Recessions come every 7 to 10 years. People with savings ride them out; people without fall behind.' },
    { id: 'boom', title: 'Boom', text: 'Growth everywhere. Rents up 25% for 8 rounds.', rentMult: 1.25, rounds: 8, real: 'In a boom asset owners gain most: rents and prices rise faster than wages.' },
    { id: 'ratehike', title: 'Interest rates up', text: 'The central bank raises rates. Everyone with a mortgaged property pays 10% of its mortgage value now.', mortgageFee: 0.10, real: 'In 2022 to 2023 rates rose faster than at any time since 1980. Borrowers with variable mortgages paid thousands more.' },
    { id: 'ratecut', title: 'Interest rates down', text: 'Cheap money. Building houses costs 25% less for 8 rounds.', buildMult: 0.75, rounds: 8, real: 'Low rates after 2008 and 2020 fuelled building and buying, and pushed prices up.' },
    { id: 'pandemic', title: 'Pandemic', text: 'Everyone pays medical costs: $20,000, or $2,000 if insured. Rents fall 25% for 6 rounds.', allPay: [20 * K, 2 * K], rentMult: 0.75, rounds: 6, real: 'COVID-19 in 2020. The uninsured and hourly workers were hit hardest; asset owners recovered within a year.' },
    { id: 'hurricane', title: 'Hurricane', text: 'Storm surge floods Riverside and the Waterfront. Owners pay $30,000 per property there, or nothing if insured.', damage: { groups: ['riverside', 'waterfront'], per: 30 * K, insuredPer: 0 }, real: 'Katrina 2005, Sandy 2012, Ian 2022. Insured owners rebuilt; many uninsured families never did.' },
    { id: 'housingboom', title: 'Housing boom', text: 'Property prices, rents and house costs rise 20%, permanently.', priceMult: 1.2, real: 'Rising prices make owners richer without doing anything, and make it harder for everyone else to buy in.' },
    { id: 'housingcrash', title: 'Housing crash', text: 'Property prices, rents and house costs fall 20%, permanently.', priceMult: 0.8, real: '2008: US house prices fell 30%. Owners who had borrowed a lot owed more than their homes were worth.' },
    { id: 'taxcut', title: 'Tax cut', text: 'Income tax rates cut by a quarter for 16 rounds.', taxMult: 0.75, rounds: 16, real: 'Tax cuts give the biggest dollar amounts to the highest earners, because they pay the most tax.' },
    { id: 'taxhike', title: 'Tax rise', text: 'Income tax rates up by a quarter for 16 rounds to pay for schools and hospitals.', taxMult: 1.25, rounds: 16 },
    { id: 'rentcontrol', title: 'Rent control', text: 'The city caps rents at half for 8 rounds.', rentMult: 0.5, rounds: 8, real: 'Rent control protects current tenants. Economists argue it also discourages landlords from building. Both are true.' },
    { id: 'stockcrash', title: 'Stock market crash', text: 'Everyone\'s savings and investments take a hit: lose 20%.', cashPct: -0.20, real: 'Crashes hit people with money to lose. People with no savings lose nothing, and gain nothing in the recovery.' },
    { id: 'stockboom', title: 'Stock market rally', text: 'Savings grow: gain 10% of your cash.', cashPct: 0.10, real: 'The richest 10% of Americans own about 90% of all shares. Rallies widen the gap.' },
    { id: 'minwage', title: 'Minimum wage raised', text: 'Every salary below $70,000 becomes $70,000.', minWage: 70 * K, real: 'A higher minimum wage lifts the lowest paid directly. The effect on jobs is argued about endlessly.' },
    { id: 'transit', title: 'New transport link', text: 'Transport squares charge double for 8 rounds.', transportMult: 2, rounds: 8, real: 'Public infrastructure raises the value of nearby private property. The public pays, owners gain.' },
    { id: 'wealthtax', title: 'One-off wealth tax', text: 'Everyone worth more than $1,000,000 pays 2% of their net worth now.', wealthTaxNow: true, real: 'A few countries tax wealth directly. It is rare because the wealthy can move, and lobby.' },
  ];

  /* First-time explanations. Shown once per human player when the thing first happens. */
  const EXPLAIN = {
    spin: ['The wheel', 'Nobody chooses where they are born. The wheel decides your starting cash, your salary, whether you have health insurance, and what you inherit. Monopoly starts everyone equal. Life does not.'],
    living: ['Living costs', 'Every year you also pay to live: rent or upkeep, food, transport. Old Money spends more, but it is a small share of their income. For the working poor it is most of their pay. Whatever is left is what you can save or invest.'],
    invest: ['Investments', 'Money in investments grows about 6% a year, paid at Payday, without you doing anything. The more you already have, the more you get. That is what "wealth compounds" means.'],
    family: ['Family support', 'Your family covered the shortfall this once. Many people have no one to call.'],
    payday: ['Payday', 'Every time you pass Payday you get a year of salary. Income tax comes off first: 10% on the first $50k, 20% up to $100k, 30% up to $200k, 40% above. Then living costs, insurance and loan payments. Trust and investment income arrive here too.'],
    rentpaid: ['Rent', 'Land on someone\'s property and you pay them rent. Rent is how owners earn money from people who own nothing. Houses multiply it.'],
    rentgot: ['Rent income', 'You just earned money without working. That is what owning does. The more you own, the more others pay you.'],
    buy: ['Buying', 'Buying a property turns cash into something that earns rent and can rise in value. Own every property of one colour and rents double; then you can build houses.'],
    group: ['Colour group complete', 'You own a whole colour group. Base rents double, and you can now build houses (up to 4, then a hotel). Each house multiplies the rent.'],
    hospital: ['Hospital', 'You are in Hospital. Leave by paying the bill ($40,000, or $4,000 with insurance) or by rolling doubles. After three turns you must pay. No insurance means the bill can wipe out a poorer player.'],
    life: ['Life cards', 'Things happen to people: accidents, promotions, babies, layoffs. The same card hits an insured player and an uninsured player very differently.'],
    world: ['World cards', 'Some things happen to everyone: recessions, pandemics, rate changes, housing booms. Notice who they hurt and who they help.'],
    tax: ['Property tax', 'Owners pay tax on what they own every year: here 1% of the value of your properties. The more you own, the more you pay, but owners can usually afford it.'],
    wealth: ['Wealth tax', 'A tax on net worth above $1,000,000. Only the rich pay it. Almost no country has one; this square is here so you can argue about it.'],
    mortgage: ['Mortgage', 'Mortgaging gives you half the property\'s price in cash now. It earns no rent until you pay the bank back with 10% interest. It is how owners survive a cash crunch that would bankrupt a renter.'],
    freshstart: ['Bankruptcy', 'You could not pay. Everything you owned goes to whoever you owed, your debts are wiped, and you start again from zero with your job. In real life this takes years and follows you on every credit check.'],
    debt: ['Out of cash', 'You owe more than you have. Sell houses or mortgage properties to raise the money. If you cannot, you are bankrupt and out. Players with assets can borrow against them; players without have nothing to sell.'],
    loan: ['Bank loans', 'The bank lends you money at 10% interest a year, paid at every Payday. How much it lends depends on who you are: the Heir can borrow $400,000, the Graduate $20,000. Cheap credit for the rich and none for the poor is one of the quiet engines of inequality.'],
    auction: ['Auction', 'When a player passes on a property, it goes to auction: everyone bids once, in secret, and the highest bid wins. Auctions are how the player with the most cash picks up bargains nobody else can afford.'],
    trade: ['Trading', 'Players can trade properties and cash. Deals are how colour groups get completed. Whoever has more to offer usually gets the better deal.'],
  };

  const TOKENS = ['🎩', '🚗', '🐕', '🚢', '🦆', '🐈', '🦖', '🐧'];
  const COLORS = ['#ed1b24', '#0072bb', '#f7941d', '#1fb25a', '#8e44ad', '#d93a96', '#17a2b8', '#6d4c41'];

  g.GAME_DATA = { K, GROUPS, BOARD, BACKGROUNDS, TAX, COSTS, LIFE, WORLD, EXPLAIN, TOKENS, COLORS };
})(typeof window !== 'undefined' ? window : globalThis);
