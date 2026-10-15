/* Real Estate Capital — game data: board, districts, backgrounds, events */
(function (g) {
  'use strict';

  const DISTRICTS = {
    oldtown:    { name: 'Old Town',            color: '#a1704f', type: 'residential', yield: 0.075, baseOcc: 0.90, wear: 1.3, desc: 'Aging rowhouses and converted lofts. Cheap, high yield, rough around the edges.' },
    industrial: { name: 'Industrial Park',     color: '#7d8c96', type: 'industrial',  yield: 0.090, baseOcc: 0.86, wear: 1.2, desc: 'Warehouses and plants. High yields, sensitive to trade and manufacturing cycles.' },
    suburbs:    { name: 'Suburbs',             color: '#5cae63', type: 'residential', yield: 0.060, baseOcc: 0.94, wear: 0.9, desc: 'Family homes. Stable, boring, dependable.' },
    university: { name: 'University District', color: '#e39a3b', type: 'residential', yield: 0.070, baseOcc: 0.92, wear: 1.5, desc: 'Student housing and campus retail. Steady demand, heavy wear and tear.' },
    midtown:    { name: 'Midtown',             color: '#9b5fc0', type: 'commercial',  yield: 0.072, baseOcc: 0.86, wear: 1.0, desc: 'Offices, retail and lofts. Rides the business cycle.' },
    waterfront: { name: 'Waterfront',          color: '#3aa7d9', type: 'residential', yield: 0.050, baseOcc: 0.88, wear: 1.0, desc: 'Luxury condos and marinas. Low yield, strong appreciation, exposed to storms.' },
    downtown:   { name: 'Downtown',            color: '#d9534f', type: 'commercial',  yield: 0.080, baseOcc: 0.84, wear: 1.0, desc: 'Trophy towers. Expensive, prestigious, volatile.' },
  };

  const P = (name, district, baseValue, type) => ({ kind: 'property', name, district, baseValue, type: type || DISTRICTS[district].type });
  const S = (kind, name, icon) => ({ kind, name, icon });

  const BOARD = [
    S('home', 'Home', '🏠'),
    P('Mill Street Rowhouse', 'oldtown', 185000),
    S('life', 'Life', '🎲'),
    P('Cannery Lofts', 'oldtown', 215000),
    S('tax', 'Tax Office', '🧾'),
    P('Harbor Lane Duplex', 'oldtown', 200000),
    P('Brickyard Flats', 'oldtown', 240000),
    P('Freight Depot', 'industrial', 330000),
    P('Cold Storage Warehouse', 'industrial', 360000),
    P('Auto Parts Plant', 'industrial', 390000),
    S('hospital', 'Hospital', '🏥'),
    P('Logistics Hub', 'industrial', 430000),
    S('bank', 'Bank', '🏦'),
    P('Maple Court Home', 'suburbs', 350000),
    P('Willow Creek Villas', 'suburbs', 390000),
    S('job', 'Job Center', '💼'),
    P('Oakridge Estates', 'suburbs', 430000),
    P('Cedar Hills Townhomes', 'suburbs', 470000),
    P('Campus View Apartments', 'university', 490000),
    P('Scholars Hall', 'university', 530000),
    S('exchange', 'Stock Exchange', '📈'),
    P('Dormitory Row', 'university', 570000),
    P('College Square Shops', 'university', 610000, 'commercial'),
    S('life', 'Life', '🎲'),
    P('Metro Plaza Offices', 'midtown', 720000),
    P('Grand Avenue Retail', 'midtown', 780000),
    S('casino', 'Casino', '🎰'),
    P('Union Station Lofts', 'midtown', 840000, 'residential'),
    P('Theater District Tower', 'midtown', 900000),
    P('Marina Condos', 'waterfront', 1000000),
    S('court', 'Courthouse', '⚖️'),
    P('Lighthouse Point Villas', 'waterfront', 1100000),
    P('Pier 9 Residences', 'waterfront', 1200000),
    S('airport', 'Airport', '✈️'),
    P('Bayview Towers', 'waterfront', 1350000),
    P('Commerce Center', 'downtown', 1500000),
    S('life', 'Life', '🎲'),
    P('Capital Exchange Building', 'downtown', 1800000),
    P('Skyline Plaza', 'downtown', 2100000),
    P('One Monarch Tower', 'downtown', 2400000),
  ];

  /* Starting situations. Deliberately unequal: that is the point. */
  const BACKGROUNDS = [
    { id: 'heir', title: 'Trust-Fund Heir', job: 'Family foundation director',
      desc: 'Born into money. Inherits a downtown tower and a waterfront building, both carrying the family\'s mortgages. Estate tax is due.',
      cash: [350000, 550000], salary: 3500, age: 27, health: 85, insurance: true, living: 4800, credit: 780,
      inherit: [{ district: 'downtown', ltv: 0.6 }, { district: 'waterfront', ltv: 0.5 }], stocks: 60000 },
    { id: 'business', title: 'Family Business Owner', job: 'Owner, family logistics firm',
      desc: 'Runs the family firm from a warehouse your father bought in the 90s. Decent income, decent debts.',
      cash: [90000, 150000], salary: 6500, age: 42, health: 72, insurance: true, living: 3800, credit: 720,
      inherit: [{ district: 'industrial', ltv: 0.4 }], stocks: 20000 },
    { id: 'engineer', title: 'Software Engineer', job: 'Senior engineer',
      desc: 'High salary, no property, a student loan that still follows you around.',
      cash: [45000, 80000], salary: 9500, age: 31, health: 80, insurance: true, living: 3600, credit: 740,
      studentLoan: 40000, stocks: 15000 },
    { id: 'nurse', title: 'Nurse', job: 'Registered nurse',
      desc: 'Steady job, good insurance, one kid, not much saved.',
      cash: [15000, 35000], salary: 5200, age: 36, health: 75, insurance: true, living: 3000, credit: 690, children: 1 },
    { id: 'construction', title: 'Construction Worker', job: 'Site foreman',
      desc: 'Inherited your parents\' old rowhouse. No health insurance, some credit-card debt, and a body that is starting to complain.',
      cash: [4000, 12000], salary: 3900, age: 45, health: 62, insurance: false, living: 2600, credit: 610,
      inherit: [{ district: 'oldtown', ltv: 0 }], debt: 6000 },
    { id: 'graduate', title: 'Recent Graduate', job: 'Junior analyst',
      desc: 'Young, healthy, broke, and carrying a student loan.',
      cash: [1000, 4000], salary: 4200, age: 24, health: 90, insurance: false, living: 2400, credit: 650, studentLoan: 38000 },
    { id: 'retiree', title: 'Retiree', job: 'Retired (pension)',
      desc: 'Paid-off suburban house, a pension, a stock portfolio, and a doctor you see a bit too often.',
      cash: [120000, 200000], salary: 2800, age: 66, health: 58, insurance: true, living: 2800, credit: 800, retired: true,
      inherit: [{ district: 'suburbs', ltv: 0 }], stocks: 80000 },
    { id: 'landlord', title: 'Small Landlord', job: 'Property manager',
      desc: 'Already owns two leveraged rentals. Knows the game, thin on cash.',
      cash: [30000, 55000], salary: 4800, age: 39, health: 70, insurance: true, living: 3100, credit: 700,
      inherit: [{ district: 'suburbs', ltv: 0.7 }, { district: 'oldtown', ltv: 0.6 }], stocks: 5000 },
    { id: 'manager', title: 'Middle Manager', job: 'Operations manager', equalOnly: true,
      desc: 'Comfortable salary, modest savings, no property. Used for "equal start" games.',
      cash: [100000, 100000], salary: 7000, age: 38, health: 74, insurance: true, living: 3500, credit: 730 },
  ];

  /* Global events. Effects that are "while active" are summed over active events each month. */
  const GLOBAL_EVENTS = [
    { id: 'recession', real: "Recessions happen every 7 to 10 years on average. Businesses sell less, so they cut jobs; people with savings ride it out, people without them fall behind.", name: 'Recession', weight: 6, duration: [10, 20],
      headline: 'Economy slips into recession', desc: 'GDP contracts for a second quarter. Vacancies rise, prices soften, layoffs begin.',
      effects: { marketDrift: -0.012, stockDrift: -0.012, occupancy: -0.08, layoffRisk: 0.03, setCycle: 'recession' } },
    { id: 'boom', real: "In a boom almost everyone looks like a genius. The trick is remembering that it ends.", name: 'Economic boom', weight: 5, duration: [10, 18],
      headline: 'Growth surges, hiring everywhere', desc: 'Strong demand lifts rents and prices.',
      effects: { marketDrift: 0.006, stockDrift: 0.01, occupancy: 0.04, setCycle: 'expansion' } },
    { id: 'rateHike', real: "Central banks (the Federal Reserve, the European Central Bank) raise rates to slow inflation. Mortgages and credit cards get pricier within weeks; in 2022 US mortgage rates doubled in a year.", name: 'Rate hike', weight: 6, duration: 0,
      headline: 'Central bank raises interest rates', desc: 'Borrowing just got more expensive. New mortgages and credit lines reprice.',
      effects: { interestShock: 1.5 } },
    { id: 'rateCut', real: "Cheaper borrowing pushes people to buy houses and stocks, so prices rise. Rates near zero after 2008 and 2020 fuelled huge asset booms that mostly benefited people who already owned assets.", name: 'Rate cut', weight: 5, duration: 0,
      headline: 'Central bank cuts interest rates', desc: 'Cheaper money. Refinancing might be worth a look.',
      effects: { interestShock: -1.25 } },
    { id: 'pandemic', real: "COVID-19 in 2020: offices emptied, shops closed, 20 million US jobs vanished in two months. Home owners and investors recovered quickly; renters and hourly workers did not.", name: 'Pandemic', weight: 2, duration: [12, 20],
      headline: 'Pandemic declared; city issues stay-at-home order', desc: 'Offices and shops empty out. Hospitals overwhelmed. Markets panic.',
      effects: { marketDrift: -0.006, occupancy: -0.12, districts: { midtown: -0.2, downtown: -0.25 }, healthRisk: 0.02, layoffRisk: 0.04, stockShock: -0.2, setCycle: 'recession' } },
    { id: 'hurricane', real: "Hurricane Katrina (2005), Sandy (2012), Ian (2022). Insurance covers the insured; the uninsured often lose everything and cannot rebuild.", name: 'Hurricane', weight: 4, duration: 0,
      headline: 'Hurricane batters the waterfront', desc: 'Storm surge floods the marina district. Uninsured owners face huge repair bills.',
      effects: { damage: [{ district: 'waterfront', count: 4, amount: [25, 55] }, { district: 'oldtown', count: 2, amount: [5, 15] }] } },
    { id: 'earthquake', real: "Earthquakes do not care who owns what. Insurance and building standards decide who recovers.", name: 'Earthquake', weight: 2, duration: 0,
      headline: 'Magnitude 6.1 earthquake shakes the city', desc: 'Structural damage reported across several districts.',
      effects: { damage: [{ district: 'any', count: 7, amount: [15, 45] }] } },
    { id: 'techBoom', real: "When big employers arrive (Amazon in Seattle, tech in San Francisco), rents in the city centre climb fast. Owners win, existing renters are pushed out.", name: 'Tech boom', weight: 4, duration: [18, 36],
      headline: 'Tech giants open regional headquarters downtown', desc: 'Office demand and salaries jump in the core.',
      effects: { districts: { downtown: 0.2, midtown: 0.15 }, stockDrift: 0.008 } },
    { id: 'factoryClosure', real: "Detroit, the English Midlands, the US Rust Belt: when factories leave, whole districts lose value for decades.", name: 'Factory closures', weight: 4, duration: [24, 48],
      headline: 'Major manufacturer moves production overseas', desc: 'Industrial Park loses its anchor tenant.',
      effects: { districts: { industrial: -0.25 }, layoffRisk: 0.02 } },
    { id: 'universityExpansion', real: "Universities bring steady demand for housing. Student rentals are high-yield but hard on the buildings.", name: 'University expansion', weight: 3, duration: 0,
      headline: 'University announces 5,000 new student places', desc: 'Student housing demand rises permanently.',
      effects: { permanent: { university: 0.12 } } },
    { id: 'rentControl', real: "Rent control protects current tenants from rent rises. Economists argue it also discourages landlords from building or maintaining. Both effects are real.", name: 'Rent control', weight: 3, duration: [36, 60],
      headline: 'City council passes rent stabilization law', desc: 'Residential rents capped at 80% of market for the duration of the law.',
      effects: { rentCap: { type: 'residential', factor: 0.8 } } },
    { id: 'taxHike', real: "Governments raise taxes to pay for schools, roads, pensions and debt. Higher taxes hit high earners hardest under a progressive system.", name: 'Tax increase', weight: 3, duration: [48, 96],
      headline: 'Legislature raises income and property taxes', desc: 'All tax bills up 15% to close the budget gap.',
      effects: { taxMult: 0.15 } },
    { id: 'taxCut', real: "Tax cuts leave more money with people and companies. The biggest cuts usually go to those who pay the most tax: the wealthy.", name: 'Tax cut', weight: 3, duration: [48, 96],
      headline: 'Sweeping tax cuts signed into law', desc: 'All tax bills down 15%.',
      effects: { taxMult: -0.15 } },
    { id: 'inflation', real: "Inflation makes everything cost more. Wages usually lag behind prices, so workers lose; people who own property or owe fixed-rate debt gain, because the debt shrinks in real terms.", name: 'Inflation surge', weight: 4, duration: [12, 24],
      headline: 'Inflation hits 6%', desc: 'Prices rise, the central bank responds, nominal asset values creep up.',
      effects: { inflation: 3.0, interestShock: 0.5, marketDrift: 0.003 } },
    { id: 'bubble', real: "Bubbles form when people buy because prices are rising, not because the thing is worth it. The US housing bubble burst in 2008 and set off a global financial crisis.", name: 'Housing bubble', weight: 3, duration: [12, 24],
      headline: 'Housing frenzy: prices up double digits', desc: 'Everyone is buying. This ends the way it always ends.',
      effects: { marketDrift: 0.015, occupancy: 0.02 }, onEnd: { marketShock: -0.18, setCycle: 'recession', headline: 'Housing bubble bursts', desc: 'Prices fall 18% in a month. Over-leveraged owners are in trouble.' } },
    { id: 'stockCrash', real: "1929, 1987, 2000, 2008, 2020. Stock crashes are sudden; recoveries take months or years. People who must sell during a crash lock in their losses.", name: 'Stock market crash', weight: 4, duration: 0,
      headline: 'Stock market loses 30% in a week', desc: 'Index funds get hammered.',
      effects: { stockShock: -0.3 } },
    { id: 'infrastructure', real: "New roads and rail raise the value of land they reach. Landowners get that gain without doing anything.", name: 'Infrastructure bill', weight: 3, duration: 0,
      headline: 'New highway and rail links approved', desc: 'Suburbs and Industrial Park become more accessible.',
      effects: { permanent: { suburbs: 0.1, industrial: 0.05 } } },
    { id: 'crimeWave', real: "Neighbourhood reputation moves prices up and down, often faster than the facts justify.", name: 'Crime wave', weight: 3, duration: [12, 24],
      headline: 'Crime spikes in Old Town', desc: 'Tenants leave, values slide.',
      effects: { districts: { oldtown: -0.15 } } },
    { id: 'insuranceCrisis', real: "After big disaster years, insurers raise premiums or leave regions entirely (Florida, California since 2023).", name: 'Insurance crisis', weight: 2, duration: [18, 30],
      headline: 'Insurers hike premiums after record claims', desc: 'Property and health insurance premiums rise 80%.',
      effects: { insuranceMult: 0.8 } },
    { id: 'oilShock', real: "1973, 1979, 2022. When energy prices spike, inflation follows and growth slows.", name: 'Oil shock', weight: 3, duration: [6, 12],
      headline: 'Oil prices spike on supply disruption', desc: 'Energy costs squeeze everyone.',
      effects: { inflation: 2.0, marketDrift: -0.004, stockDrift: -0.01 } },
    { id: 'wealthTax', real: "A few countries (Switzerland, Norway, Spain) tax wealth directly. It is rare and politically contested because the wealthy can move.", name: 'Wealth tax', weight: 2, duration: [36, 60],
      headline: 'Annual wealth tax enacted on fortunes over $2M', desc: '1% per year on net worth above $2 million.',
      effects: { wealthTax: 0.01 } },
    { id: 'transit', real: "Transit lines reliably raise nearby property values. The gain goes to owners, not to the public that paid for the line.", name: 'New transit line', weight: 3, duration: 0,
      headline: 'Light rail line opens through Midtown', desc: 'Midtown and the University District get a permanent lift.',
      effects: { permanent: { midtown: 0.08, university: 0.05 } } },
    { id: 'floodMap', real: "When flood maps are redrawn, homes become harder to insure and sell overnight.", name: 'Flood zone remap', weight: 2, duration: 0,
      headline: 'FEMA expands flood zone to cover the Waterfront', desc: 'Waterfront values take a permanent hit.',
      effects: { permanent: { waterfront: -0.08 } } },
    { id: 'migration', real: "A growing population needs housing. If building does not keep up, rents and prices rise.", name: 'Population boom', weight: 3, duration: [24, 48],
      headline: 'City population grows 4% in a year', desc: 'Housing demand climbs across the board.',
      effects: { occupancy: 0.05, marketDrift: 0.003 } },
  ];

  /* Personal life events. `choice: true` ones only fire on a Life space (they need a decision). */
  const LIFE_EVENTS = [
    { id: 'carBreakdown', weight: 6, text: 'Your car breaks down. Transmission.', cash: [-2500, -6000] },
    { id: 'wedding', weight: 3, text: 'A cousin gets married. Travel, gift, suit.', cash: [-2500, -4000] },
    { id: 'baby', weight: 2, text: 'A new baby in the family. Congratulations. Costs begin immediately.', cash: [-4000, -6000], children: 1, maxAge: 45 },
    { id: 'refund', weight: 4, text: 'The tax office recalculated last year. Refund.', cash: [1200, 3500] },
    { id: 'relativeInherit', weight: 2, text: 'A distant relative leaves you money.', cash: [10000, 60000] },
    { id: 'inheritProperty', weight: 1, text: 'An aunt leaves you her building.', giveProperty: ['oldtown', 'suburbs', 'industrial'] },
    { id: 'identity', weight: 3, text: 'Identity theft. The bank reverses most of it, not all.', cash: [-3000, -5000] },
    { id: 'homePipe', weight: 4, text: 'A pipe bursts in your apartment. Landlord says it\'s your fault.', cash: [-2500, -4500] },
    { id: 'raise', weight: 5, text: 'Annual review went well. Raise.', salaryPct: 0.05, needsJob: true },
    { id: 'bonus', weight: 4, text: 'Year-end bonus: one month of salary.', salaryMonths: 1, needsJob: true },
    { id: 'burnout', weight: 4, text: 'Burnout. You stop sleeping properly.', health: -10 },
    { id: 'jogging', weight: 4, text: 'You start running in the mornings and actually keep it up.', health: 8 },
    { id: 'lottery', weight: 1, text: 'A scratch card pays out.', cash: [5000, 20000] },
    { id: 'phone', weight: 4, text: 'Phone stolen on the subway.', cash: [-900, -1300] },
    { id: 'pet', weight: 3, text: 'The dog needs surgery.', cash: [-2500, -4000] },
    { id: 'parentCare', weight: 2, text: 'A parent needs ongoing care. You cover part of it from now on.', livingDelta: 450, minAge: 35, maxAge: 62 },
    { id: 'divorce', weight: 1, text: 'Divorce. Assets are split; you keep the properties and give up a share of your savings.', cashPct: -0.3, stocksPct: -0.3, minAge: 28 },
    { id: 'robbery', weight: 2, text: 'Your home is burgled.', cash: [-3000, -7000] },
    { id: 'sideGig', weight: 3, text: 'A weekend consulting gig pays off.', cash: [1500, 4000] },
    { id: 'lawsuitWin', weight: 1, text: 'You win a class-action settlement.', cash: [2000, 9000] },
    { id: 'friendLoan', weight: 3, choice: true, text: 'A close friend asks to borrow $5,000. They say they will pay you back in a year.',
      options: [{ id: 'lend', label: 'Lend $5,000', desc: 'Good chance they repay with a little extra. Some chance they do not.' }, { id: 'decline', label: 'Decline', desc: 'Awkward dinner, no risk.' }] },
    { id: 'stockTip', weight: 2, choice: true, text: 'A coworker swears by a "can\'t miss" biotech stock. $10,000 minimum.',
      options: [{ id: 'invest', label: 'Invest $10,000', desc: '40% chance it triples. 60% chance it goes to nearly zero.' }, { id: 'pass', label: 'Pass', desc: 'Keep your money.' }] },
    { id: 'foodTruck', weight: 2, choice: true, text: 'Your brother-in-law wants a $15,000 partner in his food truck. Projected $700/month to you.',
      options: [{ id: 'invest', label: 'Buy in for $15,000', desc: 'Adds $700/month side income. 25% chance the truck fails within a year.' }, { id: 'pass', label: 'Pass', desc: 'He will mention this at every holiday.' }] },
    { id: 'gymOrNot', weight: 3, choice: true, text: 'Your doctor says you need to take your health seriously.',
      options: [{ id: 'trainer', label: 'Hire a trainer ($2,400)', desc: 'Health +15.' }, { id: 'ignore', label: 'Ignore it', desc: 'Health -5. Doctors always say that.' }] },
  ];

  const MEDICAL = [
    { name: 'a severe flu', cost: [1500, 6000], sick: 0, health: 4, weight: 10 },
    { name: 'a dental emergency', cost: [2000, 8000], sick: 0, health: 2, weight: 8 },
    { name: 'kidney stones', cost: [10000, 30000], sick: 0, health: 5, weight: 5 },
    { name: 'a broken leg', cost: [8000, 25000], sick: 1, health: 6, weight: 6 },
    { name: 'appendicitis', cost: [15000, 45000], sick: 1, health: 8, weight: 5 },
    { name: 'injuries from a car accident', cost: [20000, 90000], sick: 1, health: 15, weight: 3 },
    { name: 'a heart attack', cost: [60000, 150000], sick: 2, health: 25, weight: 2, ageBoost: true },
    { name: 'cancer treatment', cost: [100000, 250000], sick: 3, health: 30, weight: 1, ageBoost: true },
  ];

  const JOB_EVENTS = [
    { id: 'promotion', weight: 6, text: 'Promotion. Salary up 12%.', salaryPct: 0.12 },
    { id: 'offer', weight: 4, choice: true, text: 'A competitor offers you a job at 25% more. You would lose a month of pay in the transition.',
      options: [{ id: 'accept', label: 'Accept', desc: '+25% salary, -1 month of pay now.' }, { id: 'decline', label: 'Stay put', desc: 'No change.' }] },
    { id: 'training', weight: 4, choice: true, text: 'A professional certification course is available for $6,000.',
      options: [{ id: 'pay', label: 'Enroll ($6,000)', desc: 'Salary +8%.' }, { id: 'skip', label: 'Skip it', desc: 'No change.' }] },
    { id: 'layoff', weight: 3, text: 'Restructuring. You are laid off.', layoff: true },
    { id: 'sidegig', weight: 3, text: 'Temp contract work pays a one-time $2,500.', cash: 2500 },
  ];

  const COURT_EVENTS = [
    { id: 'tenantSuit', weight: 4, needsProperty: true, text: 'A tenant sues over an injury on your property.', cash: [-5000, -25000], insuredHalf: true },
    { id: 'codeViolation', weight: 4, needsProperty: true, text: 'Building inspector fines you for code violations on run-down properties.', perBadProperty: 3000 },
    { id: 'jury', weight: 3, text: 'Jury duty. Two days of lost pay and parking.', cash: [-400, -400] },
    { id: 'smallClaims', weight: 2, text: 'You win in small claims court.', cash: [2000, 4000] },
    { id: 'ticket', weight: 4, text: 'Speeding ticket, plus court fees.', cash: [-350, -350] },
    { id: 'contract', weight: 2, needsProperty: true, text: 'You win a contract dispute with a commercial tenant.', cash: [6000, 10000] },
    { id: 'nothing', weight: 3, text: 'You renew your driver\'s licence. Nothing else happens.', cash: [-60, -60] },
  ];

  const TAX = {
    brackets: [[20000, 0.10], [80000, 0.20], [200000, 0.32], [Infinity, 0.40]],
    standardDeduction: 14000,
    propertyTaxRate: 0.011,
    capitalGains: 0.20,
    estateExemption: 1000000,
    estateRate: 0.10,
  };

  const COSTS = {
    maintenanceRate: 0.004,     // per year, share of value
    propertyInsuranceRate: 0.0035,
    healthPremiumBase: 350,
    healthDeductible: 2500,
    healthCoinsurance: 0.10,
    healthOopMax: 9000,
    closingCost: 0.02,
    agentFee: 0.05,
    quickSaleFactor: 0.80,
    offMarketPremium: 0.05,
    stockFee: 0.005,
    stockDividend: 0.02,
  };

  /* Classroom mode replaces the casino with a community event and drops a few adult life events. */
  const CLASSROOM = { hideLifeEvents: ['divorce', 'lottery'], casino: { name: 'Fundraiser', icon: '🎗️' } };

  /* Policy settings: what the government does. Picked at setup; useful for comparing runs. */
  const POLICIES = {
    balanced: { name: 'Balanced', desc: 'Moderate taxes, basic safety net. Unemployment pays 40% for 6 months; health insurance is private.', taxMult: 1, unemploymentRate: 0.4, unemploymentMonths: 6, universalHealth: false, estateRate: 0.10, premiumMult: 1 },
    welfare: { name: 'Strong safety net', desc: 'Higher taxes fund public health insurance for everyone and unemployment at 70% for a year. Inheritances over $1M taxed at 30%.', taxMult: 1.3, unemploymentRate: 0.7, unemploymentMonths: 12, universalHealth: true, estateRate: 0.30, premiumMult: 0 },
    laissez: { name: 'Low tax, no net', desc: 'Taxes down 30%. No unemployment benefit, no estate tax, insurance costs more. You are on your own.', taxMult: 0.7, unemploymentRate: 0, unemploymentMonths: 0, universalHealth: false, estateRate: 0, premiumMult: 1.3 },
  };

  /* Scenarios: how the world looks on day one. */
  const SCENARIOS = {
    normal: { name: 'Normal times', desc: 'Random backgrounds, a growing economy, whatever comes next.' },
    equal: { name: 'Everyone equal', desc: 'All players start as a middle manager with $100k. Is the outcome still unequal?', equalStart: true },
    unequal: { name: 'Born lucky, born unlucky', desc: 'One trust-fund heir, one graduate with student debt, one uninsured construction worker, one nurse.', backgrounds: ['heir', 'graduate', 'construction', 'nurse'] },
    crisis: { name: 'Crash on day one', desc: 'The game opens in a deep recession with a housing bust already under way.', startCycle: 'recession', startEvents: ['recession'], marketShock: -0.15 },
    inflation: { name: 'High inflation', desc: 'Prices are rising 6% a year and the central bank is raising rates.', startEvents: ['inflation'], interestRate: 7.5 },
  };

  const GLOSSARY = [
    ['Net worth', 'Everything you own minus everything you owe. The score of the game, and the usual measure of wealth.'],
    ['Cash flow', 'Money coming in each month minus money going out. Positive cash flow lets you save; negative cash flow eats savings or builds debt.'],
    ['Mortgage', 'A loan to buy a building, paid back monthly over many years with interest. The building is the collateral: stop paying and the bank takes it.'],
    ['Equity', 'The part of a building you actually own: its value minus the mortgage still owed.'],
    ['Leverage', 'Using borrowed money to buy more than you could with cash alone. It multiplies gains when prices rise and losses when they fall.'],
    ['Interest rate', 'The price of borrowing money, as a percentage per year. Set in large part by the central bank.'],
    ['Inflation', 'Prices rising across the economy. Your money buys less; wages usually catch up late.'],
    ['Recession', 'A period when the economy shrinks. Fewer jobs, lower rents, lower prices.'],
    ['Rent yield', 'Yearly rent divided by the building\'s price. Cheap districts have high yields; prestige districts have low yields but rise more in value.'],
    ['Occupancy', 'The share of a building that has paying tenants. Run-down buildings and high rents lower it.'],
    ['Capital gain', 'Profit from selling something for more than you paid. Taxed at 20% in this game, lower than wages: a real feature of most tax systems.'],
    ['Progressive tax', 'A tax where higher incomes pay a higher percentage. Here: 10%, 20%, 32% and 40% bands.'],
    ['Estate tax', 'Tax on inherited wealth above a threshold. Some countries have none; some tax it heavily.'],
    ['Deductible', 'The part of a medical bill you pay before insurance pays anything.'],
    ['Credit score', 'A number lenders use to judge how risky you are. Low scores mean higher rates or no loan at all.'],
    ['Foreclosure', 'The bank seizing and selling a building whose owner cannot pay. Forced sales happen at bad prices.'],
    ['Bankruptcy', 'Owing more than you can ever pay. Your assets are taken; you leave the game.'],
    ['Index fund', 'A basket of many companies\' shares. Goes up and down with the whole stock market and pays small dividends.'],
    ['Appreciation', 'A building becoming worth more over time without you doing anything. The main way owners get richer while they sleep.'],
    ['Safety net', 'Government programs (unemployment benefit, public health care) that catch people when things go wrong.'],
  ];

  const TOKENS = ['🎩', '🚗', '🐕', '🚢', '👢', '🐈', '🚲', '🎸'];

  const COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ff922b'];

  g.GAME_DATA = { DISTRICTS, BOARD, BACKGROUNDS, GLOBAL_EVENTS, LIFE_EVENTS, MEDICAL, JOB_EVENTS, COURT_EVENTS, TAX, COSTS, COLORS, TOKENS, CLASSROOM, POLICIES, SCENARIOS, GLOSSARY };
})(typeof window !== 'undefined' ? window : globalThis);
