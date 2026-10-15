/* Real Estate Capital — simulation engine. No DOM here; the UI talks to it through controllers and events. */
(function (g) {
  'use strict';
  const D = g.GAME_DATA;
  const BOARD_SIZE = 40;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v) => Math.round(v);

  function fmtMoney(n, short) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (short && n >= 1e6) s = '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    else if (short && n >= 1e4) s = '$' + Math.round(n / 1e3) + 'k';
    else s = '$' + Math.round(n).toLocaleString('en-US');
    return neg ? '-' + s : s;
  }
  function mortgagePayment(balance, annualRatePct, months) {
    const r = annualRatePct / 100 / 12;
    if (r <= 0) return balance / months;
    return balance * r / (1 - Math.pow(1 + r, -months));
  }

  class Game {
    constructor(cfg) {
      this.cfg = Object.assign({ years: 15, startYear: 2026, seed: null, equalStart: false, players: [], policy: 'balanced', scenario: 'normal', classroom: false }, cfg);
      this.policy = D.POLICIES[this.cfg.policy] || D.POLICIES.balanced;
      this.scenario = D.SCENARIOS[this.cfg.scenario] || D.SCENARIOS.normal;
      if (this.scenario.equalStart) this.cfg.equalStart = true;
      const s = this.cfg.seed;
      this.seed = (s === null || s === undefined || s === '') ? Math.floor(Math.random() * 2147483647) : (Number(s) >>> 0);
      this.rng = mulberry32(this.seed);
      this.listeners = {};
      this.controllers = {};
      this.hooks = {};
      this.month = 0;
      this.over = false;
      this.turnIndex = 0;
      this.current = null;
      this.phase = 'setup';
      this.lastRoll = null;
      this.log = [];
      this.news = [];
      this.eco = { marketIndex: 100, stockIndex: 100, interestRate: 5.0, inflation: 2.5, cycle: 'expansion', cycleAge: 0, history: [] };
      this.activeEvents = [];
      this.eventCooldown = {};
      this.firedOnce = {};
      this.districtShift = {};
      this.scheduled = [];
      this.properties = [];
      this.winner = null;
      D.BOARD.forEach((sp, i) => { if (sp.kind === 'property') this.properties.push(this.makeProperty(sp, i)); });
      if (this.scenario.interestRate) this.eco.interestRate = this.scenario.interestRate;
      if (this.scenario.startCycle) this.eco.cycle = this.scenario.startCycle;
      if (this.scenario.marketShock) this.eco.marketIndex *= 1 + this.scenario.marketShock;
      this.players = this.cfg.players.map((pc, i) => this.makePlayer(pc, i));
      this.assignBackgrounds();
      this.recordHistory();
      this.addNews('Game begins', `${this.players.length} players. ${this.cfg.years} years. Policy: ${this.policy.name}. Scenario: ${this.scenario.name}.`);
      (this.scenario.startEvents || []).forEach(id => { const def = D.GLOBAL_EVENTS.find(e => e.id === id); if (def) this.startEvent(def); });
    }

    /* ---------- randomness ---------- */
    rand() { return this.rng(); }
    randInt(a, b) { return a + Math.floor(this.rand() * (b - a + 1)); }
    randRange(a, b) { return a + this.rand() * (b - a); }
    chance(p) { return this.rand() < p; }
    pick(arr) { return arr[Math.floor(this.rand() * arr.length)]; }
    gauss() { let u = 0, v = 0; while (u === 0) u = this.rand(); while (v === 0) v = this.rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    weightedPick(arr, wfn) {
      const ws = arr.map(wfn); const total = ws.reduce((a, b) => a + b, 0);
      if (total <= 0) return null;
      let r = this.rand() * total;
      for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
      return arr[arr.length - 1];
    }

    /* ---------- events / listeners ---------- */
    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    emit(ev, data) { (this.listeners[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
    setController(playerId, ctrl) { this.controllers[playerId] = ctrl; }
    ctrl(p) { return this.controllers[p.id]; }

    /* ---------- creation ---------- */
    makeProperty(sp, i) {
      const d = D.DISTRICTS[sp.district];
      return { id: i, name: sp.name, district: sp.district, type: sp.type, baseValue: sp.baseValue, owner: null,
        condition: this.randInt(65, 95), renovation: 0, strategy: 'market', insured: false, mortgage: null,
        listedPrice: null, occupancy: d.baseOcc, costBasis: 0, improvements: 0 };
    }
    freshYear() { return { salary: 0, rent: 0, dividends: 0, propExpenses: 0, mortgageInterest: 0, gains: 0, oop: 0, other: 0 }; }
    makePlayer(pc, i) {
      return { id: i, name: pc.name || `Player ${i + 1}`, isAI: !!pc.isAI, token: pc.token || D.TOKENS[i % D.TOKENS.length], persona: { risk: this.randRange(0.3, 0.9) }, color: D.COLORS[i % D.COLORS.length],
        position: 0, cash: 0, salary: 0, job: '', age: 30, health: 75, healthInsurance: false, living: 3000, creditScore: 700,
        debt: 0, loans: [], stocks: 0, stockBasis: 0, skipTurns: 0, skipReason: '', laidOff: 0, unemploymentLeft: 0, prevSalary: 0,
        sickMonths: 0, retired: false, children: 0, sideIncome: 0, bankrupt: false, dead: false, inDefault: false, freeTrade: false,
        bankPromo: false, lastTaxable: 0, year: this.freshYear(), stats: { taxes: 0, medical: 0, rentCollected: 0, rentPaid: 0, interestPaid: 0, wages: 0, dividends: 0, gains: 0, propertyExpenses: 0 },
        background: null, bgTitle: '', startNetWorth: 0 };
    }
    assignBackgrounds() {
      const pool = this.scenario.backgrounds ? this.scenario.backgrounds.map(id => D.BACKGROUNDS.find(b => b.id === id)) : this.shuffle(D.BACKGROUNDS.filter(b => !b.equalOnly));
      this.players.forEach((p, i) => {
        const bg = this.cfg.equalStart ? D.BACKGROUNDS.find(b => b.id === 'manager') : pool[i % pool.length];
        this.applyBackground(p, bg);
      });
      this.players.forEach(p => { p.startNetWorth = this.netWorth(p); });
    }
    applyBackground(p, bg) {
      p.background = bg.id; p.bgTitle = bg.title; p.job = bg.job;
      p.cash = this.cfg.equalStart ? round((bg.cash[0] + bg.cash[1]) / 2) : round(this.randRange(bg.cash[0], bg.cash[1]) / 100) * 100;
      p.salary = bg.salary; p.age = bg.age; p.health = bg.health; p.healthInsurance = !!bg.insurance; p.living = bg.living;
      p.creditScore = bg.credit; p.retired = !!bg.retired; if (this.policy.universalHealth) p.healthInsurance = true; p.children = bg.children || 0; p.debt = bg.debt || 0;
      if (bg.studentLoan) p.loans.push({ name: 'Student loan', balance: bg.studentLoan, rate: 5.5, payment: round(mortgagePayment(bg.studentLoan, 5.5, 120)), monthsLeft: 120 });
      if (bg.stocks) { p.stocks = bg.stocks / this.eco.stockIndex; p.stockBasis = bg.stocks; }
      let inherited = 0;
      (bg.inherit || []).forEach(spec => {
        const choices = this.properties.filter(pr => pr.district === spec.district && !pr.owner);
        if (!choices.length) return;
        const prop = this.pick(choices);
        prop.owner = p.id; prop.condition = this.randInt(55, 85);
        const v = this.propertyValue(prop);
        prop.costBasis = v; inherited += v;
        if (spec.ltv > 0) this.setMortgage(prop, round(v * spec.ltv), this.eco.interestRate + 1.0, 300);
        this.logp(p, `${p.name} starts owning ${prop.name} (${fmtMoney(v, true)}${spec.ltv ? `, mortgage ${fmtMoney(prop.mortgage.balance, true)}` : ''}).`);
      });
      if (inherited > 0) {
        const tax = round(Math.max(0, inherited - D.TAX.estateExemption) * this.policy.estateRate);
        if (tax > 0) { p.cash -= tax; p.stats.taxes += tax; p.stats.estateTax = (p.stats.estateTax || 0) + tax; this.logp(p, `${p.name} pays ${fmtMoney(tax)} estate tax on inherited property.`); }
      }
      if (p.cash < 0) { p.debt += -p.cash; p.cash = 0; }
      this.logp(p, `${p.name}: ${bg.title}. ${bg.desc}`);
    }

    /* ---------- time ---------- */
    get year() { return this.cfg.startYear + Math.floor(this.month / 12); }
    get monthOfYear() { return this.month % 12; }
    dateLabel(m) { const mm = (m === undefined ? this.month : m); return `${MONTHS[mm % 12]} ${this.cfg.startYear + Math.floor(mm / 12)}`; }
    totalMonths() { return this.cfg.years * 12; }

    /* ---------- logging ---------- */
    addLog(text, opts) {
      const entry = Object.assign({ month: this.month, text, type: 'info', player: null }, opts || {});
      this.log.push(entry); if (this.log.length > 600) this.log.shift();
      this.emit('log', entry);
    }
    logp(p, text, type) { this.addLog(text, { player: p.id, type: type || 'info' }); }
    addNews(headline, desc, kind, real) {
      const n = { month: this.month, headline, desc, kind: kind || 'info', real: real || null };
      this.news.unshift(n); if (this.news.length > 200) this.news.pop();
      this.addLog(`NEWS: ${headline}`, { type: 'news' });
      this.emit('news', n);
    }

    /* ---------- economy helpers ---------- */
    eventSum(key) { return this.activeEvents.reduce((s, e) => s + (e.effects[key] || 0), 0); }
    taxMult() { return clamp((1 + this.eventSum('taxMult')) * this.policy.taxMult, 0.3, 2.5); }
    insuranceMult() { return (1 + this.eventSum('insuranceMult')) * this.policy.premiumMult; }
    rentCap(type) { let f = 1; this.activeEvents.forEach(e => { const rc = e.effects.rentCap; if (rc && rc.type === type) f = Math.min(f, rc.factor); }); return f; }
    districtMult(d) {
      let m = 1 + (this.districtShift[d] || 0);
      this.activeEvents.forEach(e => { if (e.effects.districts && e.effects.districts[d]) m *= 1 + e.effects.districts[d]; });
      return m;
    }
    creditRate() { return this.eco.interestRate + 17; }
    mortgageRate(p) { return this.eco.interestRate + 1.5 + Math.max(0, (700 - (p ? p.creditScore : 700)) / 100) - (p && p.bankPromo ? 0.5 : 0); }
    loanRate(p) { return this.eco.interestRate + 4 + Math.max(0, (720 - p.creditScore) / 40); }
    healthPremium(p) { return this.policy.universalHealth ? 0 : round((D.COSTS.healthPremiumBase + Math.max(0, p.age - 30) * 9 + p.children * 120) * this.insuranceMult()); }

    /* ---------- property math ---------- */
    ownsDistrict(ownerId, district) {
      if (ownerId === null || ownerId === undefined) return false;
      return this.properties.filter(pr => pr.district === district).every(pr => pr.owner === ownerId);
    }
    propertyValue(prop) {
      const base = prop.baseValue * (this.eco.marketIndex / 100) * this.districtMult(prop.district);
      const cond = 0.6 + 0.4 * prop.condition / 100;
      const reno = 1 + 0.1 * prop.renovation;
      const mono = this.ownsDistrict(prop.owner, prop.district) ? 1.1 : 1;
      return round(base * cond * reno * mono / 1000) * 1000;
    }
    marketPrice(prop) { return this.propertyValue(prop); }
    grossRent(prop) {
      const d = D.DISTRICTS[prop.district];
      let rent = this.propertyValue(prop) * d.yield / 12;
      rent *= (1 + 0.12 * prop.renovation) / (1 + 0.1 * prop.renovation);
      if (prop.strategy === 'low') rent *= 0.85; else if (prop.strategy === 'high') rent *= 1.2;
      rent *= this.rentCap(prop.type);
      if (this.ownsDistrict(prop.owner, prop.district)) rent *= 1.25;
      return round(rent);
    }
    targetOccupancy(prop) {
      const d = D.DISTRICTS[prop.district];
      let occ = d.baseOcc + this.eventSum('occupancy') + (this.eco.cycle === 'recession' ? -0.05 : this.eco.cycle === 'peak' ? 0.02 : 0);
      occ += (prop.condition - 70) / 100 * 0.3;
      if (prop.strategy === 'low') occ += 0.07; else if (prop.strategy === 'high') occ -= 0.15;
      if (this.ownsDistrict(prop.owner, prop.district)) occ += 0.03;
      return clamp(occ, 0.25, 1);
    }
    monthlyRentCollected(prop) { return round(this.grossRent(prop) * prop.occupancy); }
    landingFee(prop) { return this.grossRent(prop); }
    monthlyPropertyCosts(prop) {
      const v = this.propertyValue(prop);
      const maint = v * D.COSTS.maintenanceRate / 12;
      const tax = v * D.TAX.propertyTaxRate / 12 * this.taxMult();
      const ins = prop.insured ? v * D.COSTS.propertyInsuranceRate / 12 * this.insuranceMult() : 0;
      const mort = prop.mortgage ? prop.mortgage.payment : 0;
      return { maint: round(maint), tax: round(tax), ins: round(ins), mort: round(mort), total: round(maint + tax + ins + mort) };
    }
    netMonthlyCashflow(prop) { return this.monthlyRentCollected(prop) - this.monthlyPropertyCosts(prop).total; }
    repairCost(prop) { return round((100 - prop.condition) / 100 * this.propertyValue(prop) * 0.12 / 100) * 100; }
    renovateCost(prop) { return round(prop.baseValue * 0.12 * this.eco.marketIndex / 100 / 100) * 100; }
    equity(prop) { return this.propertyValue(prop) - (prop.mortgage ? prop.mortgage.balance : 0); }
    setMortgage(prop, amount, rate, months) {
      prop.mortgage = { balance: round(amount), rate: Math.round(rate * 100) / 100, payment: round(mortgagePayment(amount, rate, months)), monthsLeft: months, origMonths: months };
    }
    playerProperties(p) { return this.properties.filter(pr => pr.owner === p.id); }
    stocksValue(p) { return round(p.stocks * this.eco.stockIndex); }
    loanBalance(p) { return p.loans.reduce((s, l) => s + l.balance, 0); }
    netWorth(p) {
      if (p.bankrupt || p.dead) return 0;
      let nw = p.cash + this.stocksValue(p) - p.debt - this.loanBalance(p);
      this.playerProperties(p).forEach(pr => { nw += this.equity(pr); });
      return round(nw);
    }
    creditLimit(p) { return round((10000 + p.salary * 3) * clamp(p.creditScore / 700, 0.3, 1.3)); }
    loanCapacity(p) { return Math.max(0, round(p.salary * 12 * clamp(p.creditScore / 700, 0.2, 1.2)) - this.loanBalance(p)); }
    monthlyObligations(p) {
      let o = p.living + p.children * 700 + (p.healthInsurance ? this.healthPremium(p) : 0);
      this.playerProperties(p).forEach(pr => { o += this.monthlyPropertyCosts(pr).total; });
      p.loans.forEach(l => { o += l.payment; });
      return round(o);
    }
    monthlyIncome(p) {
      let inc = (p.laidOff > 0 ? (p.unemploymentLeft > 0 ? p.prevSalary * this.policy.unemploymentRate : 0) : p.salary) + p.sideIncome;
      this.playerProperties(p).forEach(pr => { inc += this.monthlyRentCollected(pr); });
      inc += this.stocksValue(p) * D.COSTS.stockDividend / 12;
      return round(inc);
    }
    unrealizedGains(p) { let g = this.stocksValue(p) - p.stockBasis; this.playerProperties(p).forEach(pr => { g += this.propertyValue(pr) - pr.costBasis - pr.improvements; }); return round(g); }
    incomeSources(p) {
      const st = p.stats;
      return { wages: round(st.wages), rent: round(st.rentCollected - st.propertyExpenses - st.interestPaid), investing: round(st.gains + st.dividends + this.unrealizedGains(p)), taxes: round(st.taxes), estateTax: round(st.estateTax || 0), medical: round(st.medical) };
    }
    isActive(p) { return !p.bankrupt && !p.dead; }
    activePlayers() { return this.players.filter(p => this.isActive(p)); }
    playerName(id) { const p = this.players[id]; return p ? p.name : 'Bank'; }

    /* ---------- cash helpers ---------- */
    addCash(p, amt, reason, type) {
      amt = round(amt); p.cash += amt;
      if (reason) this.logp(p, `${p.name}: ${amt >= 0 ? '+' : '-'}${fmtMoney(Math.abs(amt))} ${reason}`, type || (amt >= 0 ? 'gain' : 'loss'));
    }
    transfer(from, to, amt, reason) {
      amt = round(amt); from.cash -= amt; to.cash += amt;
      this.logp(from, `${from.name} pays ${fmtMoney(amt)} to ${to.name} ${reason}`, 'loss');
    }

    /* ---------- prompts ---------- */
    async prompt(p, spec) {
      const c = this.ctrl(p);
      spec.options = spec.options || [{ id: 'ok', label: 'OK' }];
      let r = c && c.decide ? await c.decide(p, spec) : (spec.options.find(o => !o.disabled) || {}).id;
      const ok = spec.options.find(o => o.id === r && !o.disabled);
      return ok ? r : (spec.options.find(o => !o.disabled) || spec.options[0]).id;
    }
    async notify(p, title, text, kind) {
      this.logp(p, text, kind);
      await this.prompt(p, { type: 'notice', title, text, options: [{ id: 'ok', label: 'OK' }] });
    }

    /* ---------- game loop ---------- */
    async run() {
      this.phase = 'playing';
      this.emit('start');
      while (!this.over) {
        for (let i = this.turnIndex; i < this.players.length; i++) {
          this.turnIndex = i;
          const p = this.players[i];
          if (!this.isActive(p)) continue;
          await this.takeTurn(p);
          if (this.checkGameOver()) break;
        }
        if (this.over) break;
        this.turnIndex = 0;
        await this.endOfMonth();
        this.checkGameOver();
      }
      this.phase = 'over';
      this.emit('gameover', this.finalRanking());
    }
    checkGameOver() {
      if (this.over) return true;
      const active = this.activePlayers();
      if (active.length <= 1 && this.players.length > 1) { this.over = true; this.winner = active[0] || null; }
      else if (this.month >= this.totalMonths()) { this.over = true; this.winner = this.finalRanking()[0]; }
      if (this.over) this.addNews('Game over', this.winner ? `${this.winner.name} finishes with the highest net worth: ${fmtMoney(this.netWorth(this.winner), true)}.` : 'Nobody survived.');
      return this.over;
    }
    finalRanking() {
      return this.players.slice().sort((a, b) => {
        const aa = this.isActive(a) ? 1 : 0, bb = this.isActive(b) ? 1 : 0;
        if (aa !== bb) return bb - aa;
        return this.netWorth(b) - this.netWorth(a);
      });
    }

    async takeTurn(p) {
      this.current = p; this.turnPhase = 'pre'; this.lastRoll = null; p.freeTrade = false;
      this.emit('turnStart', p);
      this.emit('change');
      if (p.skipTurns > 0) {
        p.skipTurns--;
        this.logp(p, `${p.name} is ${p.skipReason} and misses this turn.`, 'warn');
        const c = this.ctrl(p); if (c && c.skipped) await c.skipped(p);
        this.resolveInsolvency(p, true);
        this.emit('turnEnd', p); this.emit('change');
        return;
      }
      const c = this.ctrl(p);
      if (c && c.preRoll) await c.preRoll(p);
      if (!this.isActive(p) || this.over) return;
      let doubles = 0;
      while (true) {
        const d1 = this.randInt(1, 6), d2 = this.randInt(1, 6);
        this.lastRoll = [d1, d2];
        const from = p.position;
        if (d1 === d2) doubles++;
        if (doubles === 3) {
          p.position = 10; p.skipTurns += 1; p.skipReason = 'in hospital with burnout';
          this.logp(p, `${p.name} rolls doubles three times in a row, collapses from exhaustion and is taken to Hospital.`, 'warn');
          this.emit('moved', { player: p, from, to: p.position, dice: [d1, d2] });
          if (this.hooks.moved) await this.hooks.moved({ player: p, from, to: p.position, dice: [d1, d2] });
          await this.notify(p, 'Three doubles!', 'Too much running around. You collapse from exhaustion and spend next month in Hospital.', 'warn');
          break;
        }
        p.position = (p.position + d1 + d2) % BOARD_SIZE;
        this.turnPhase = 'moving';
        this.logp(p, `${p.name} rolls ${d1}+${d2}${d1 === d2 ? ' (doubles!)' : ''} and lands on ${D.BOARD[p.position].name}.`);
        this.emit('moved', { player: p, from, to: p.position, dice: [d1, d2] });
        this.emit('change');
        if (this.hooks.moved) await this.hooks.moved({ player: p, from, to: p.position, dice: [d1, d2] });
        await this.resolveLanding(p);
        if (d1 !== d2 || !this.isActive(p) || this.over || p.skipTurns > 0) break;
        await this.notify(p, 'Doubles!', 'You rolled doubles, so you roll again.', 'gain');
      }
      this.turnPhase = 'post';
      this.emit('change');
      if (!this.isActive(p) || this.over) return;
      if (c && c.postRoll) await c.postRoll(p);
      this.resolveInsolvency(p, true);
      p.bankPromo = false;
      this.emit('turnEnd', p); this.emit('change');
    }

    /* ---------- landing ---------- */
    async resolveLanding(p) {
      const sp = D.BOARD[p.position];
      switch (sp.kind) {
        case 'property': return this.landProperty(p, this.properties.find(pr => pr.id === p.position));
        case 'home': p.health = clamp(p.health + 2, 0, 100); return this.notify(p, 'Home', 'A quiet month at home. Health +2.', 'gain');
        case 'hospital': return this.landHospital(p);
        case 'exchange': p.freeTrade = true; this.emit('openTab', 'stocks'); return this.notify(p, 'Stock Exchange', 'You visit the exchange. Trading fees and closing costs are waived for the rest of this turn.');
        case 'court': return this.landCourt(p);
        case 'tax': return this.landTax(p);
        case 'bank': return this.landBank(p);
        case 'job': return this.landJob(p);
        case 'casino': return this.cfg.classroom ? this.landFundraiser(p) : this.landCasino(p);
        case 'airport': return this.landAirport(p);
        case 'life': return this.lifeEvent(p, true);
      }
    }
    async landProperty(p, prop) {
      if (!prop.owner && prop.owner !== 0) {
        const price = this.marketPrice(p.freeTrade ? prop : prop);
        const closing = p.freeTrade ? 0 : round(price * D.COSTS.closingCost);
        const down20 = round(price * 0.2) + closing;
        const canMortgage = p.creditScore >= 580;
        const rent = this.grossRent(Object.assign({}, prop, { owner: p.id }));
        const r = await this.prompt(p, { type: 'buy', title: `${prop.name} is for sale`, propertyId: prop.id,
          text: `${D.DISTRICTS[prop.district].name}. Asking ${fmtMoney(price)} (+${fmtMoney(closing)} closing). Condition ${round(prop.condition)}/100. Potential rent about ${fmtMoney(rent)}/month before costs.`,
          options: [
            { id: 'cash', label: `Buy with cash (${fmtMoney(price + closing)})`, disabled: p.cash < price + closing },
            { id: 'mortgage', label: `Buy with 80% mortgage (${fmtMoney(down20)} down, ${this.mortgageRate(p).toFixed(2)}%)`, disabled: !canMortgage || p.cash < down20, desc: canMortgage ? `Payment about ${fmtMoney(mortgagePayment(price * 0.8, this.mortgageRate(p), 360))}/month for 30 years.` : 'Credit score too low for a mortgage.' },
            { id: 'pass', label: 'Pass' },
          ] });
        if (r === 'cash') this.buyProperty(p, prop.id, 0, price);
        else if (r === 'mortgage') this.buyProperty(p, prop.id, 0.8, price);
        return;
      }
      if (prop.owner === p.id) { this.logp(p, `${p.name} checks in on ${prop.name}.`); return; }
      const owner = this.players[prop.owner];
      const fee = this.landingFee(prop);
      this.transfer(p, owner, fee, `for a month at ${prop.name}`);
      p.stats.rentPaid += fee; owner.stats.rentCollected += fee; owner.year.rent += fee;
      await this.prompt(p, { type: 'notice', title: prop.name, text: `${owner.name} owns this. You pay ${fmtMoney(fee)} for your stay.` });
    }
    async landHospital(p) {
      const cost = p.healthInsurance ? 50 : 400;
      p.health = clamp(p.health + 4, 0, 100);
      this.addCash(p, -cost, 'for a check-up');
      let text = `Check-up: health +4 (now ${round(p.health)}). Cost ${fmtMoney(cost)}.`;
      if (p.health < 45) {
        const extra = p.healthInsurance ? 1500 : 9000;
        this.addCash(p, -extra, 'for tests and treatment');
        p.health = clamp(p.health + 10, 0, 100);
        text += ` The doctor orders tests and a treatment course: ${fmtMoney(extra)}, health +10 more.`;
      }
      await this.notify(p, 'Hospital', text);
    }
    async landCourt(p) {
      const props = this.playerProperties(p);
      const ev = this.weightedPick(D.COURT_EVENTS.filter(e => !e.needsProperty || props.length), e => e.weight);
      let text = ev.text;
      if (ev.cash) { let amt = round(this.randRange(ev.cash[0], ev.cash[1]) / 10) * 10; if (ev.insuredHalf && props.some(pr => pr.insured)) { amt = round(amt / 2); text += ' Your insurer covers half.'; } this.addCash(p, amt, ev.id === 'tenantSuit' ? 'in damages' : ''); text += ` (${fmtMoney(amt)})`; }
      if (ev.perBadProperty) { const bad = props.filter(pr => pr.condition < 45); const fine = bad.length * ev.perBadProperty; if (fine) { this.addCash(p, -fine, 'in code violation fines'); text += ` ${bad.length} propert${bad.length === 1 ? 'y' : 'ies'} below standard: ${fmtMoney(fine)}.`; } else text = 'Building inspector visits. Everything is up to code.'; }
      await this.notify(p, 'Courthouse', text);
    }
    async landTax(p) {
      if (this.chance(0.35) && p.lastTaxable > 0) {
        if (this.chance(0.6)) { const due = round(p.lastTaxable * 0.04 + 1000); this.addCash(p, -due, 'in back taxes and penalties'); p.stats.taxes += due; await this.notify(p, 'Tax audit', `The auditor finds unreported income from last year. You owe ${fmtMoney(due)}.`, 'loss'); }
        else await this.notify(p, 'Tax audit', 'You are audited. Your records are clean. Three days of your life gone.');
      } else if (this.chance(0.3)) { const r = round(this.randRange(800, 2500)); this.addCash(p, r, 'tax refund'); await this.notify(p, 'Tax Office', `A refund arrives: ${fmtMoney(r)}.`, 'gain'); }
      else await this.notify(p, 'Tax Office', 'You file some paperwork and wait in line. Nothing happens.');
    }
    async landBank(p) {
      p.bankPromo = true;
      const opts = [];
      if (p.debt > 3000 && p.creditScore >= 600) opts.push({ id: 'consolidate', label: `Consolidate ${fmtMoney(p.debt)} credit debt into a 5-year loan at ${this.loanRate(p).toFixed(1)}%`, desc: `Instead of ${this.creditRate().toFixed(1)}% on the credit line.` });
      opts.push({ id: 'none', label: 'Just a chat', desc: 'Mortgage rate promo: -0.5% on any mortgage you take this turn.' });
      const r = await this.prompt(p, { type: 'bank', title: 'Bank', text: 'Your banker reviews your accounts.', options: opts });
      if (r === 'consolidate') { const amt = p.debt; p.debt = 0; p.loans.push({ name: 'Consolidation loan', balance: amt, rate: this.loanRate(p), payment: round(mortgagePayment(amt, this.loanRate(p), 60)), monthsLeft: 60 }); this.logp(p, `${p.name} consolidates ${fmtMoney(amt)} of credit debt into a loan.`); }
      this.emit('openTab', 'bank');
    }
    async landJob(p) {
      if (p.retired) { p.health = clamp(p.health + 5, 0, 100); return this.notify(p, 'Job Center', 'You volunteer at the community center. Health +5.'); }
      if (p.laidOff > 0) { p.laidOff = 0; p.unemploymentLeft = 0; p.salary = round(p.prevSalary * this.randRange(0.9, 1.05)); return this.notify(p, 'Job Center', `You land a new job: ${fmtMoney(p.salary)}/month.`, 'gain'); }
      const inRecession = this.eco.cycle === 'recession';
      const ev = this.weightedPick(D.JOB_EVENTS, e => e.weight * (e.id === 'layoff' && inRecession ? 2.5 : 1));
      if (ev.choice) {
        const r = await this.prompt(p, { type: 'job', title: 'Job Center', text: ev.text, options: ev.options.map(o => Object.assign({}, o, { disabled: (ev.id === 'training' && o.id === 'pay' && p.cash < 6000) })) });
        if (ev.id === 'offer' && r === 'accept') { this.addCash(p, -p.salary, 'lost in the transition'); p.salary = round(p.salary * 1.25); this.logp(p, `${p.name} switches jobs: ${fmtMoney(p.salary)}/month.`, 'gain'); }
        if (ev.id === 'training' && r === 'pay') { this.addCash(p, -6000, 'for a certification course'); p.salary = round(p.salary * 1.08); this.logp(p, `${p.name} is certified: salary now ${fmtMoney(p.salary)}/month.`, 'gain'); }
        return;
      }
      if (ev.salaryPct) { p.salary = round(p.salary * (1 + ev.salaryPct)); return this.notify(p, 'Job Center', `${ev.text} Now ${fmtMoney(p.salary)}/month.`, 'gain'); }
      if (ev.cash) { this.addCash(p, ev.cash, 'from contract work'); return this.notify(p, 'Job Center', ev.text, 'gain'); }
      if (ev.layoff) { this.layoff(p); return this.notify(p, 'Job Center', `${ev.text} ${this.policy.unemploymentRate > 0 ? `Unemployment pays ${Math.round(this.policy.unemploymentRate * 100)}% for up to ${this.policy.unemploymentMonths} months.` : 'There is no unemployment benefit.'} Visit the Job Center or wait it out.`, 'loss'); }
    }
    layoff(p) {
      if (p.retired || p.laidOff > 0) return;
      p.prevSalary = p.salary; p.laidOff = this.randInt(3, 7); p.unemploymentLeft = Math.min(this.policy.unemploymentMonths, p.laidOff); p.salary = 0;
      this.logp(p, `${p.name} is laid off.`, 'loss');
    }
    async landCasino(p) {
      const opts = [{ id: '0', label: 'Walk past' }];
      [1000, 5000, 10000, 25000].forEach(b => opts.push({ id: String(b), label: `Bet ${fmtMoney(b)}`, disabled: p.cash < b, desc: '47% chance to double it.' }));
      const r = Number(await this.prompt(p, { type: 'casino', title: 'Casino', text: 'The tables are open. The house edge is real.', options: opts }));
      if (r > 0) {
        if (this.chance(0.47)) { this.addCash(p, r, 'won at the casino'); await this.notify(p, 'Casino', `You win ${fmtMoney(r)}.`, 'gain'); }
        else { this.addCash(p, -r, 'lost at the casino'); await this.notify(p, 'Casino', `You lose ${fmtMoney(r)}.`, 'loss'); }
      }
    }
    async landFundraiser(p) {
      const r = await this.prompt(p, { type: 'casino', title: 'Community fundraiser', text: 'The neighbourhood is raising money for the youth centre.', options: [
        { id: 'give', label: 'Donate $2,000', desc: 'Tax-deductible. Health +3: it feels good.', disabled: p.cash < 2000 }, { id: 'volunteer', label: 'Volunteer a weekend', desc: 'Health +2, meet people.' }, { id: 'skip', label: 'Walk past' }] });
      if (r === 'give') { this.addCash(p, -2000, 'donated to the youth centre'); p.year.other -= 2000; p.health = clamp(p.health + 3, 0, 100); }
      else if (r === 'volunteer') { p.health = clamp(p.health + 2, 0, 100); this.logp(p, `${p.name} volunteers at the fundraiser.`); }
    }
    async landAirport(p) {
      const r = await this.prompt(p, { type: 'airport', title: 'Airport', text: 'Where to?', options: [
        { id: 'vacation', label: 'Two-week vacation ($3,000)', desc: 'Health +15. You miss your next turn.', disabled: p.cash < 3000 },
        { id: 'business', label: 'Business trip ($1,500)', desc: '60% chance to land a $6,000 contract.', disabled: p.cash < 1500 || p.retired },
        { id: 'stay', label: 'Stay home' }] });
      if (r === 'vacation') { this.addCash(p, -3000, 'on a vacation'); p.health = clamp(p.health + 15, 0, 100); p.skipTurns += 1; p.skipReason = 'on vacation'; }
      else if (r === 'business') { this.addCash(p, -1500, 'on a business trip'); if (this.chance(0.6)) { this.addCash(p, 6000, 'from a new contract'); await this.notify(p, 'Airport', 'The trip pays off: a $6,000 contract.', 'gain'); } else await this.notify(p, 'Airport', 'The client went with someone else.', 'loss'); }
    }

    /* ---------- life events ---------- */
    async lifeEvent(p, allowChoice, silent) {
      const pool = D.LIFE_EVENTS.filter(e => !(this.cfg.classroom && D.CLASSROOM.hideLifeEvents.includes(e.id)) && (allowChoice || !e.choice) && (!e.minAge || p.age >= e.minAge) && (!e.maxAge || p.age <= e.maxAge) && (!e.needsJob || (!p.retired && p.laidOff === 0)));
      const ev = this.weightedPick(pool, e => e.weight);
      if (!ev) return;
      let text = ev.text;
      if (ev.choice) {
        const opts = ev.options.map(o => Object.assign({}, o));
        if (ev.id === 'friendLoan') opts[0].disabled = p.cash < 5000;
        if (ev.id === 'stockTip') opts[0].disabled = p.cash < 10000;
        if (ev.id === 'foodTruck') opts[0].disabled = p.cash < 15000;
        if (ev.id === 'gymOrNot') opts[0].disabled = p.cash < 2400;
        const r = await this.prompt(p, { type: 'life', title: 'Life', text, options: opts });
        if (ev.id === 'friendLoan' && r === 'lend') { this.addCash(p, -5000, 'lent to a friend'); if (this.chance(0.65)) this.schedule(p, 12, 5500, 'Your friend pays you back, with a little extra.'); else this.schedule(p, 12, 0, 'Your friend never paid back the $5,000. You stop bringing it up.'); }
        if (ev.id === 'stockTip' && r === 'invest') { this.addCash(p, -10000, 'on a stock tip'); if (this.chance(0.4)) { this.addCash(p, 30000, 'the tip paid off'); await this.notify(p, 'Life', 'The biotech stock triples. You cash out $30,000.', 'gain'); } else { this.addCash(p, 800, 'salvaged from the tip'); await this.notify(p, 'Life', 'The drug fails its trial. You salvage $800.', 'loss'); } }
        if (ev.id === 'foodTruck' && r === 'invest') { this.addCash(p, -15000, 'invested in a food truck'); p.sideIncome += 700; if (this.chance(0.25)) this.schedule(p, this.randInt(6, 12), 0, 'The food truck goes under. Your $700/month side income stops.', { sideIncome: -700 }); }
        if (ev.id === 'gymOrNot') { if (r === 'trainer') { this.addCash(p, -2400, 'on a personal trainer'); p.health = clamp(p.health + 15, 0, 100); } else p.health = clamp(p.health - 5, 0, 100); }
        return;
      }
      let kind = 'info';
      if (ev.cash) { const amt = round(this.randRange(ev.cash[0], ev.cash[1]) / 10) * 10; this.addCash(p, amt); text += ` (${amt >= 0 ? '+' : ''}${fmtMoney(amt)})`; kind = amt >= 0 ? 'gain' : 'loss'; }
      if (ev.children) { p.children += ev.children; text += ` Living costs +$700/month.`; }
      if (ev.salaryPct) { p.salary = round(p.salary * (1 + ev.salaryPct)); text += ` Salary now ${fmtMoney(p.salary)}/month.`; kind = 'gain'; }
      if (ev.salaryMonths) { this.addCash(p, p.salary * ev.salaryMonths); text += ` (+${fmtMoney(p.salary * ev.salaryMonths)})`; kind = 'gain'; }
      if (ev.health) { p.health = clamp(p.health + ev.health, 0, 100); text += ` Health ${ev.health > 0 ? '+' : ''}${ev.health}.`; kind = ev.health > 0 ? 'gain' : 'loss'; }
      if (ev.livingDelta) { p.living += ev.livingDelta; text += ` Living costs +${fmtMoney(ev.livingDelta)}/month.`; kind = 'loss'; }
      if (ev.cashPct) { const c = round(p.cash * ev.cashPct); const s = p.stocks * ev.stocksPct; p.cash += c; p.stocks += s; text += ` (${fmtMoney(c)} cash, ${fmtMoney(round(s * this.eco.stockIndex))} stocks)`; kind = 'loss'; }
      if (ev.giveProperty) {
        const choices = this.properties.filter(pr => !pr.owner && pr.owner !== 0 && ev.giveProperty.includes(pr.district));
        if (choices.length) { const prop = this.pick(choices); prop.owner = p.id; prop.costBasis = this.propertyValue(prop); prop.condition = this.randInt(40, 70); prop.mortgage = null; prop.listedPrice = null; text += ` You now own ${prop.name} (${fmtMoney(prop.costBasis, true)}). It needs work.`; kind = 'gain'; }
        else { const amt = 40000; this.addCash(p, amt); text = `A distant aunt leaves you ${fmtMoney(amt)}.`; kind = 'gain'; }
      }
      if (silent) this.logp(p, `LIFE: ${text}`, kind); else await this.notify(p, 'Life', text, kind);
    }
    schedule(p, monthsAhead, amount, text, extra) { this.scheduled.push(Object.assign({ due: this.month + monthsAhead, playerId: p.id, amount, text }, extra || {})); }

    /* ---------- medical ---------- */
    medicalEmergency(p) {
      const ageF = Math.max(0, p.age - 45) / 20;
      const kind = this.weightedPick(D.MEDICAL, m => m.weight * (m.ageBoost ? 1 + ageF * 3 + (100 - p.health) / 40 : 1));
      const bill = round(this.randRange(kind.cost[0], kind.cost[1]) / 100) * 100;
      let oop = bill;
      if (p.healthInsurance) {
        oop = Math.min(bill, D.COSTS.healthDeductible + Math.max(0, bill - D.COSTS.healthDeductible) * D.COSTS.healthCoinsurance);
        oop = round(Math.min(oop, Math.max(0, D.COSTS.healthOopMax - p.year.oop)));
      }
      p.cash -= oop; p.year.oop += oop; p.stats.medical += oop;
      p.health = clamp(p.health - kind.health, 0, 100);
      if (kind.sick > 0) { p.skipTurns += kind.sick; p.skipReason = 'in hospital'; p.sickMonths += kind.sick; }
      this.logp(p, `MEDICAL: ${p.name} is treated for ${kind.name}. Bill ${fmtMoney(bill)}, ${p.healthInsurance ? `insurance covers all but ${fmtMoney(oop)}` : `no insurance: you pay ${fmtMoney(oop)}`}.${kind.sick ? ` Out of action for ${kind.sick} month${kind.sick > 1 ? 's' : ''}.` : ''}`, 'medical');
      this.emit('medical', { player: p, kind, bill, oop });
    }

    /* ---------- monthly processing ---------- */
    async endOfMonth() {
      this.turnPhase = 'month';
      this.current = null;
      this.updateEconomy();
      this.processScheduled();
      const summaries = [];
      this.players.forEach(p => { if (this.isActive(p)) summaries.push(this.processPlayerMonth(p)); });
      let yearReport = null;
      if (this.monthOfYear === 11) yearReport = this.yearEnd();
      this.month++;
      this.recordHistory();
      this.emit('monthEnd', { summaries, yearReport });
      this.emit('change');
      if (this.hooks.monthEnd) await this.hooks.monthEnd({ summaries, yearReport });
      if (yearReport && this.hooks.yearEnd) await this.hooks.yearEnd(yearReport);
    }
    recordHistory() { this.eco.history.push({ month: this.month, market: this.eco.marketIndex, stock: this.eco.stockIndex, rate: this.eco.interestRate, netWorth: this.players.map(p => this.netWorth(p)) }); }

    updateEconomy() {
      const e = this.eco;
      const CYC = { expansion: { drift: 0.0035, next: 'peak', minLen: 18, pNext: 0.06 }, peak: { drift: 0.005, next: 'recession', minLen: 6, pNext: 0.15 }, recession: { drift: -0.011, next: 'recovery', minLen: 8, pNext: 0.12 }, recovery: { drift: 0.002, next: 'expansion', minLen: 6, pNext: 0.15 } };
      e.cycleAge++;
      let c = CYC[e.cycle];
      if (e.cycleAge > c.minLen && this.chance(c.pNext)) { e.cycle = c.next; e.cycleAge = 0; c = CYC[e.cycle]; this.addNews(`Economy enters ${e.cycle}`, { expansion: 'Steady growth resumes.', peak: 'The economy is running hot. Rates and rents at highs.', recession: 'Output falls. Vacancies rise and prices soften.', recovery: 'The worst is over. Prices stabilize.' }[e.cycle], 'eco'); }
      // events: expire
      this.activeEvents = this.activeEvents.filter(ev => {
        if (ev.monthsLeft === null) return false;
        ev.monthsLeft--;
        if (ev.monthsLeft <= 0) { this.endEvent(ev); return false; }
        return true;
      });
      Object.keys(this.eventCooldown).forEach(k => { if (--this.eventCooldown[k] <= 0) delete this.eventCooldown[k]; });
      // events: start
      if (this.activeEvents.length < 2 && this.chance(0.10)) {
        const pool = D.GLOBAL_EVENTS.filter(ev => !this.eventCooldown[ev.id] && !this.activeEvents.some(a => a.id === ev.id) && !(ev.effects.permanent && this.firedOnce[ev.id]));
        const def = this.weightedPick(pool, ev => ev.weight);
        if (def) this.startEvent(def);
      }
      // rates and inflation
      const inflTarget = 2.5 + this.eventSum('inflation') + (e.cycle === 'peak' ? 1 : e.cycle === 'recession' ? -1 : 0);
      e.inflation = clamp(e.inflation + (inflTarget - e.inflation) * 0.15 + this.gauss() * 0.15, -1, 12);
      const rateTarget = 1.5 + e.inflation + (e.cycle === 'peak' ? 0.75 : e.cycle === 'recession' ? -1.5 : 0);
      if (this.chance(0.35)) e.interestRate = clamp(e.interestRate + Math.sign(rateTarget - e.interestRate) * Math.min(0.25, Math.abs(rateTarget - e.interestRate)), 0.5, 15);
      // prices
      const drift = c.drift + this.eventSum('marketDrift') - (e.interestRate - 5) * 0.0006 + (e.inflation - 2.5) * 0.0008;
      e.marketIndex *= 1 + drift + this.gauss() * 0.007;
      e.stockIndex *= 1 + drift * 0.8 + 0.004 + this.eventSum('stockDrift') + this.gauss() * 0.035;
      e.marketIndex = Math.max(20, e.marketIndex); e.stockIndex = Math.max(5, e.stockIndex);
    }
    startEvent(def) {
      const dur = def.duration ? this.randInt(def.duration[0], def.duration[1]) : null;
      const ev = { id: def.id, name: def.name, headline: def.headline, desc: def.desc, effects: def.effects, monthsLeft: dur, startMonth: this.month, onEnd: def.onEnd || null };
      this.applyShocks(ev.effects);
      if (dur) this.activeEvents.push(ev);
      this.eventCooldown[def.id] = 36;
      if (def.effects.permanent) this.firedOnce[def.id] = true;
      this.addNews(def.headline, def.desc + (dur ? ` (expected to last about ${dur} months)` : ''), 'event', def.real);
      this.emit('globalEvent', ev);
    }
    endEvent(ev) {
      this.addNews(`${ev.name} ends`, `The effects of "${ev.headline}" fade.`, 'eco');
      if (ev.onEnd) { this.applyShocks(ev.onEnd); this.addNews(ev.onEnd.headline, ev.onEnd.desc, 'event'); }
    }
    applyShocks(fx) {
      const e = this.eco;
      if (fx.setCycle) { e.cycle = fx.setCycle; e.cycleAge = 0; }
      if (fx.interestShock) e.interestRate = clamp(e.interestRate + fx.interestShock, 0.5, 15);
      if (fx.stockShock) e.stockIndex *= 1 + fx.stockShock;
      if (fx.marketShock) e.marketIndex *= 1 + fx.marketShock;
      if (fx.permanent) Object.keys(fx.permanent).forEach(d => { this.districtShift[d] = (this.districtShift[d] || 0) + fx.permanent[d]; });
      if (fx.damage) fx.damage.forEach(dm => {
        const pool = this.shuffle(this.properties.filter(pr => dm.district === 'any' || pr.district === dm.district)).slice(0, dm.count);
        pool.forEach(pr => {
          const hit = this.randInt(dm.amount[0], dm.amount[1]);
          if (pr.insured && pr.owner !== null) { this.logp(this.players[pr.owner], `${pr.name} is damaged (-${hit} condition) but insurance covers the repairs.`, 'warn'); return; }
          pr.condition = clamp(pr.condition - hit, 0, 100);
          if (pr.owner !== null) this.logp(this.players[pr.owner], `${pr.name} is damaged: condition -${hit} (now ${round(pr.condition)}). Uninsured.`, 'loss');
        });
      });
    }
    processScheduled() {
      const due = this.scheduled.filter(s => s.due <= this.month);
      this.scheduled = this.scheduled.filter(s => s.due > this.month);
      due.forEach(s => { const p = this.players[s.playerId]; if (!this.isActive(p)) return; if (s.amount) this.addCash(p, s.amount); if (s.sideIncome) p.sideIncome = Math.max(0, p.sideIncome + s.sideIncome); this.logp(p, s.text, s.amount > 0 ? 'gain' : 'loss'); });
    }

    processPlayerMonth(p) {
      const s = { player: p, income: 0, expenses: 0, rent: 0, propCosts: 0, notes: [] };
      // --- income
      let salary = 0;
      if (p.laidOff > 0) {
        p.laidOff--;
        if (p.unemploymentLeft > 0) { salary = round(p.prevSalary * this.policy.unemploymentRate); p.unemploymentLeft--; s.notes.push(`Unemployment benefit ${fmtMoney(salary)}`); }
        if (p.laidOff === 0) { p.salary = round(p.prevSalary * this.randRange(0.85, 1.05)); this.logp(p, `${p.name} finds a new job: ${fmtMoney(p.salary)}/month.`, 'gain'); }
      } else if (p.sickMonths > 0) {
        p.sickMonths--; salary = p.healthInsurance ? round(p.salary * 0.6) : 0;
        s.notes.push(p.healthInsurance ? 'Sick leave: 60% pay' : 'Sick leave: unpaid');
      } else salary = p.salary;
      salary += p.sideIncome;
      p.cash += salary; p.year.salary += salary; p.stats.wages += salary; s.income += salary;
      // --- living
      const living = p.living + p.children * 700;
      const premium = p.healthInsurance ? this.healthPremium(p) : 0;
      p.cash -= living + premium; s.expenses += living + premium;
      // --- properties
      this.playerProperties(p).forEach(pr => {
        const d = D.DISTRICTS[pr.district];
        pr.occupancy = clamp(this.targetOccupancy(pr) + this.gauss() * 0.03, 0.2, 1);
        const rent = this.monthlyRentCollected(pr);
        p.cash += rent; p.year.rent += rent; p.stats.rentCollected += rent; s.rent += rent; s.income += rent;
        const c = this.monthlyPropertyCosts(pr);
        p.cash -= c.maint + c.tax + c.ins; p.year.propExpenses += c.maint + c.tax + c.ins; p.stats.propertyExpenses += c.maint + c.tax + c.ins; s.propCosts += c.maint + c.tax + c.ins; s.expenses += c.maint + c.tax + c.ins;
        if (pr.mortgage) {
          const m = pr.mortgage;
          const interest = m.balance * m.rate / 100 / 12;
          const principal = Math.min(m.balance, m.payment - interest);
          const pay = round(interest + principal);
          m.balance = round(m.balance - principal); m.monthsLeft--;
          p.cash -= pay; p.year.mortgageInterest += interest; p.stats.interestPaid += interest; s.propCosts += pay; s.expenses += pay;
          if (m.balance <= 0) { pr.mortgage = null; this.logp(p, `${p.name} pays off the mortgage on ${pr.name}.`, 'gain'); }
        }
        pr.condition = clamp(pr.condition - (0.45 + this.rand() * 0.4) * d.wear, 0, 100);
        if (this.chance(0.02)) { const hit = this.randInt(8, 20); pr.condition = clamp(pr.condition - hit, 0, 100); this.logp(p, `${this.pick(['Roof leak', 'Boiler failure', 'Plumbing burst', 'Electrical fault', 'Storm damage', 'Tenant trashed a unit'])} at ${pr.name}: condition -${hit}.`, 'warn'); }
      });
      // --- stocks
      const div = round(this.stocksValue(p) * D.COSTS.stockDividend / 12);
      if (div) { p.cash += div; p.year.dividends += div; p.stats.dividends += div; s.income += div; }
      // --- debts
      if (p.debt > 0) {
        const interest = round(p.debt * this.creditRate() / 100 / 12);
        p.debt += interest; p.stats.interestPaid += interest;
        const minPay = Math.min(p.debt, Math.max(100, round(p.debt * 0.03)));
        if (p.cash > 0) { const pay = Math.min(minPay, p.cash); p.cash -= pay; p.debt -= pay; s.expenses += pay; }
        s.notes.push(`Credit line interest ${fmtMoney(interest)}`);
      }
      p.loans = p.loans.filter(l => {
        const interest = l.balance * l.rate / 100 / 12;
        const principal = Math.min(l.balance, l.payment - interest);
        const pay = round(interest + principal);
        l.balance = round(l.balance - principal); l.monthsLeft--; p.cash -= pay; s.expenses += pay; p.stats.interestPaid += interest;
        if (l.balance <= 0) { this.logp(p, `${p.name} pays off the ${l.name.toLowerCase()}.`, 'gain'); return false; }
        return true;
      });
      // --- health
      let dh = -(0.3 + Math.max(0, p.age - 40) * 0.012) + (p.healthInsurance ? 0.12 : 0) + (p.health < 50 ? 0.3 : 0) + (p.health > 85 ? -0.15 : 0) + this.gauss() * 0.3;
      p.health = clamp(p.health + dh, 0, 100);
      const pMed = 0.006 + (100 - p.health) * 0.00035 + Math.max(0, p.age - 50) * 0.0008 + this.eventSum('healthRisk');
      if (this.chance(pMed)) { this.medicalEmergency(p); s.notes.push('Medical emergency'); }
      // --- layoffs from events / cycle
      const layoffRisk = this.eventSum('layoffRisk') + (this.eco.cycle === 'recession' ? 0.008 : 0);
      if (layoffRisk > 0 && !p.retired && p.laidOff === 0 && this.chance(layoffRisk)) { this.layoff(p); s.notes.push('Laid off'); }
      // --- random life event
      if (this.chance(0.03)) { this.lifeEvent(p, false, true); s.notes.push('Life event'); }
      // --- credit score
      const util = p.debt / Math.max(1, this.creditLimit(p));
      p.creditScore = clamp(p.creditScore + (p.cash < 0 ? -8 : util > 0.5 ? -4 : p.debt === 0 ? 3 : 1), 300, 850);
      // --- death
      if (p.health <= 0) { this.die(p); return s; }
      // --- insolvency (credit only; forced sales happen at end of their next turn)
      this.resolveInsolvency(p, false);
      s.cash = p.cash; s.net = s.income - s.expenses; p.lastMonth = { income: s.income, expenses: s.expenses, net: s.net, rent: s.rent, notes: s.notes.slice() };
      this.logp(p, `Statement ${this.dateLabel()}: income ${fmtMoney(s.income)}, expenses ${fmtMoney(s.expenses)}, net ${s.net >= 0 ? '+' : '-'}${fmtMoney(Math.abs(s.net))}. Cash ${fmtMoney(p.cash)}.${s.notes.length ? ' ' + s.notes.join('; ') + '.' : ''}`, 'statement');
      return s;
    }

    yearEnd() {
      const report = { year: this.year, rows: [] };
      this.players.forEach(p => {
        if (!this.isActive(p)) return;
        const y = p.year;
        const rentalNet = y.rent - y.propExpenses - y.mortgageInterest;
        const taxable = Math.max(0, y.salary + rentalNet + y.dividends + y.other - D.TAX.standardDeduction);
        let tax = 0, prev = 0;
        for (const [cap, rate] of D.TAX.brackets) { if (taxable > prev) tax += (Math.min(taxable, cap) - prev) * rate; prev = cap; }
        tax = round(tax * this.taxMult());
        let wealthTax = 0;
        const wt = this.eventSum('wealthTax');
        if (wt > 0) wealthTax = round(Math.max(0, this.netWorth(p) - 2000000) * wt);
        p.cash -= tax + wealthTax; p.stats.taxes += tax + wealthTax; p.lastTaxable = taxable;
        const raise = p.retired || p.laidOff > 0 ? 0 : this.eco.inflation / 100 + this.randRange(-0.005, 0.03);
        if (raise) p.salary = round(p.salary * (1 + raise));
        p.living = round(p.living * (1 + this.eco.inflation / 100));
        p.age++;
        let note = '';
        if (p.age >= 67 && !p.retired) { p.retired = true; p.salary = round(p.salary * 0.45); p.job = 'Retired (pension)'; note = 'Retired: pension is 45% of final salary.'; this.logp(p, `${p.name} retires. Pension ${fmtMoney(p.salary)}/month.`, 'warn'); }
        this.logp(p, `${this.year} taxes: income ${fmtMoney(y.salary + rentalNet + y.dividends)} taxable ${fmtMoney(taxable)} tax ${fmtMoney(tax)}${wealthTax ? ` wealth tax ${fmtMoney(wealthTax)}` : ''}.`, 'tax');
        report.rows.push({ player: p, salary: y.salary, rent: y.rent, propExpenses: y.propExpenses + y.mortgageInterest, dividends: y.dividends, gains: y.gains, taxable, tax, wealthTax, oop: y.oop, netWorth: this.netWorth(p), note });
        p.year = this.freshYear();
      });
      report.rows.sort((a, b) => b.netWorth - a.netWorth);
      this.addNews(`${this.year} year-end: tax season`, `Income tax bills are paid. Rates ${this.eco.interestRate.toFixed(2)}%, inflation ${this.eco.inflation.toFixed(1)}%, market index ${round(this.eco.marketIndex)}.`, 'eco');
      return report;
    }

    /* ---------- insolvency ---------- */
    resolveInsolvency(p, allowForcedSales) {
      if (!this.isActive(p)) return;
      if (p.cash >= 0) { p.inDefault = false; return; }
      const avail = this.creditLimit(p) - p.debt;
      if (avail > 0) { const use = Math.min(avail, -p.cash); p.debt += use; p.cash += use; this.logp(p, `${p.name} draws ${fmtMoney(use)} on the credit line (${this.creditRate().toFixed(1)}%).`, 'warn'); }
      if (p.cash >= 0) { p.inDefault = false; return; }
      if (!allowForcedSales) {
        if (!p.inDefault) this.logp(p, `${p.name} is ${fmtMoney(-p.cash)} short with no credit left. Raise cash before the end of your next turn or assets will be seized.`, 'loss');
        p.inDefault = true; return;
      }
      if (p.stocks > 0) { this.sellStocks(p, this.stocksValue(p), true); this.logp(p, `${p.name}'s stocks are liquidated to cover the shortfall.`, 'loss'); }
      while (p.cash < 0) {
        const props = this.playerProperties(p).sort((a, b) => this.equity(b) - this.equity(a));
        if (!props.length) break;
        const pr = props[0];
        this.logp(p, `FORECLOSURE: ${pr.name} is seized and sold at a discount.`, 'loss');
        this.quickSale(p, pr.id, true);
      }
      if (p.cash < 0) this.bankrupt(p); else p.inDefault = false;
    }
    bankrupt(p) {
      p.bankrupt = true;
      this.playerProperties(p).forEach(pr => { pr.owner = null; pr.mortgage = null; pr.listedPrice = null; });
      p.debt = 0; p.loans = []; p.stocks = 0; p.cash = 0;
      this.addNews(`${p.name} declares bankruptcy`, `Assets seized by creditors. ${p.name} is out of the game.`, 'event');
      this.emit('bankrupt', p);
    }
    die(p) {
      p.dead = true;
      this.playerProperties(p).forEach(pr => { pr.owner = null; pr.mortgage = null; pr.listedPrice = null; });
      this.addNews(`${p.name} has died`, `Age ${p.age}. The estate is liquidated. ${p.name} is out of the game.`, 'event');
      this.emit('death', p);
    }

    /* ---------- transactions (synchronous, validated) ---------- */
    fail(msg) { return { ok: false, msg }; }
    ok(msg) { this.emit('change'); return { ok: true, msg }; }
    prop(id) { return this.properties.find(pr => pr.id === id); }

    buyProperty(p, propId, mortgagePct, priceOverride) {
      const pr = this.prop(propId);
      if (!pr) return this.fail('No such property');
      if (pr.owner !== null) return this.fail('Already owned');
      const price = priceOverride !== undefined && priceOverride !== null ? priceOverride : round(this.marketPrice(pr) * (1 + D.COSTS.offMarketPremium));
      const closing = p.freeTrade ? 0 : round(price * D.COSTS.closingCost);
      mortgagePct = clamp(mortgagePct || 0, 0, 0.8);
      if (mortgagePct > 0 && p.creditScore < 580) return this.fail('Credit score too low for a mortgage');
      const loan = round(price * mortgagePct);
      const need = price - loan + closing;
      if (p.cash < need) return this.fail(`Need ${fmtMoney(need)} in cash`);
      p.cash -= need; pr.owner = p.id; pr.costBasis = price; pr.improvements = 0; pr.listedPrice = null;
      if (loan > 0) this.setMortgage(pr, loan, this.mortgageRate(p), 360);
      p.year.propExpenses += closing;
      this.logp(p, `${p.name} buys ${pr.name} for ${fmtMoney(price)}${loan ? ` with a ${fmtMoney(loan)} mortgage at ${pr.mortgage.rate}%` : ' in cash'}.`, 'deal');
      this.emit('deal', { type: 'buy', player: p, prop: pr, price });
      return this.ok(`Bought ${pr.name}`);
    }
    _settleSale(seller, pr, price, feeRate) {
      const fee = round(price * feeRate);
      let proceeds = price - fee;
      if (pr.mortgage) { proceeds -= pr.mortgage.balance; pr.mortgage = null; }
      const gain = price - fee - pr.costBasis - pr.improvements;
      let tax = 0;
      seller.stats.gains += gain;
      if (gain > 0) { tax = round(gain * D.TAX.capitalGains * this.taxMult()); seller.stats.taxes += tax; seller.year.gains += gain; }
      seller.cash += proceeds - tax;
      pr.listedPrice = null; pr.renovation = pr.renovation; pr.owner = null; pr.costBasis = 0; pr.improvements = 0;
      return { fee, tax, proceeds: proceeds - tax, gain };
    }
    quickSale(p, propId, forced) {
      const pr = this.prop(propId);
      if (!pr || pr.owner !== p.id) return this.fail('Not your property');
      const price = round(this.propertyValue(pr) * (forced ? 0.75 : D.COSTS.quickSaleFactor));
      const r = this._settleSale(p, pr, price, 0.02);
      this.logp(p, `${p.name} sells ${pr.name} to a cash buyer for ${fmtMoney(price)} (net ${fmtMoney(r.proceeds)}${r.tax ? `, capital gains tax ${fmtMoney(r.tax)}` : ''}).`, 'deal');
      this.emit('deal', { type: 'quick', player: p, prop: pr, price });
      return this.ok('Sold');
    }
    listProperty(p, propId, price) {
      const pr = this.prop(propId);
      if (!pr || pr.owner !== p.id) return this.fail('Not your property');
      price = round(price);
      if (!(price > 0)) return this.fail('Bad price');
      pr.listedPrice = price;
      this.logp(p, `${p.name} lists ${pr.name} for ${fmtMoney(price)}.`, 'deal');
      return this.ok('Listed');
    }
    unlistProperty(p, propId) { const pr = this.prop(propId); if (!pr || pr.owner !== p.id) return this.fail('Not your property'); pr.listedPrice = null; return this.ok('Unlisted'); }
    transferSale(buyer, propId, price, mortgagePct) {
      const pr = this.prop(propId);
      const seller = this.players[pr.owner];
      const closing = buyer.freeTrade ? 0 : round(price * D.COSTS.closingCost);
      mortgagePct = clamp(mortgagePct || 0, 0, 0.8);
      if (mortgagePct > 0 && buyer.creditScore < 580) return this.fail('Credit score too low for a mortgage');
      const loan = round(Math.min(price, this.propertyValue(pr)) * mortgagePct);
      const need = price - loan + closing;
      if (buyer.cash < need) return this.fail(`Need ${fmtMoney(need)} in cash`);
      const shortfall = pr.mortgage ? pr.mortgage.balance - (price - round(price * D.COSTS.agentFee)) : 0;
      if (shortfall > 0 && seller.cash < shortfall) return this.fail('Seller cannot cover their mortgage at this price');
      const r = this._settleSale(seller, pr, price, D.COSTS.agentFee);
      buyer.cash -= need; pr.owner = buyer.id; pr.costBasis = price; pr.improvements = 0; buyer.year.propExpenses += closing;
      if (loan > 0) this.setMortgage(pr, loan, this.mortgageRate(buyer), 360);
      this.logp(buyer, `${buyer.name} buys ${pr.name} from ${seller.name} for ${fmtMoney(price)}${loan ? ` (${fmtMoney(loan)} mortgage)` : ''}. Seller nets ${fmtMoney(r.proceeds)}.`, 'deal');
      this.emit('deal', { type: 'sale', player: buyer, seller, prop: pr, price });
      return this.ok('Bought');
    }
    buyListed(buyer, propId, mortgagePct) {
      const pr = this.prop(propId);
      if (!pr || pr.owner === null || pr.listedPrice === null) return this.fail('Not for sale');
      if (pr.owner === buyer.id) return this.fail('You own it');
      return this.transferSale(buyer, propId, pr.listedPrice, mortgagePct);
    }
    async makeOffer(buyer, propId, price, mortgagePct) {
      const pr = this.prop(propId);
      if (!pr || pr.owner === null || pr.owner === buyer.id) return this.fail('Cannot offer on this');
      price = round(price);
      const closing = buyer.freeTrade ? 0 : round(price * D.COSTS.closingCost);
      const loan = round(Math.min(price, this.propertyValue(pr)) * clamp(mortgagePct || 0, 0, 0.8));
      if (buyer.cash < price - loan + closing) return this.fail(`Need ${fmtMoney(price - loan + closing)} in cash`);
      const seller = this.players[pr.owner];
      this.logp(buyer, `${buyer.name} offers ${seller.name} ${fmtMoney(price)} for ${pr.name}.`, 'deal');
      const r = await this.prompt(seller, { type: 'offer', title: `Offer for ${pr.name}`, propertyId: pr.id, price, from: buyer.id,
        text: `${buyer.name} offers ${fmtMoney(price)} for ${pr.name} (market value ${fmtMoney(this.propertyValue(pr))}${pr.mortgage ? `, mortgage ${fmtMoney(pr.mortgage.balance)}` : ''}). After the 5% agent fee you would net ${fmtMoney(price - round(price * D.COSTS.agentFee) - (pr.mortgage ? pr.mortgage.balance : 0))} before capital gains tax.`,
        options: [{ id: 'accept', label: 'Accept' }, { id: 'decline', label: 'Decline' }] });
      if (r !== 'accept') { this.logp(seller, `${seller.name} declines the offer.`, 'deal'); return this.fail(`${seller.name} declined`); }
      return this.transferSale(buyer, propId, price, mortgagePct);
    }
    repair(p, propId) {
      const pr = this.prop(propId); if (!pr || pr.owner !== p.id) return this.fail('Not your property');
      const cost = this.repairCost(pr); if (cost <= 0) return this.fail('Nothing to repair');
      if (p.cash < cost) return this.fail(`Need ${fmtMoney(cost)}`);
      p.cash -= cost; p.year.propExpenses += cost; pr.condition = 100;
      this.logp(p, `${p.name} repairs ${pr.name} for ${fmtMoney(cost)}.`);
      return this.ok('Repaired');
    }
    renovate(p, propId) {
      const pr = this.prop(propId); if (!pr || pr.owner !== p.id) return this.fail('Not your property');
      if (pr.renovation >= 3) return this.fail('Fully renovated');
      const cost = this.renovateCost(pr); if (p.cash < cost) return this.fail(`Need ${fmtMoney(cost)}`);
      p.cash -= cost; pr.improvements += cost; pr.renovation++; pr.condition = clamp(pr.condition + 15, 0, 100);
      this.logp(p, `${p.name} renovates ${pr.name} (level ${pr.renovation}) for ${fmtMoney(cost)}.`);
      return this.ok('Renovated');
    }
    setStrategy(p, propId, strategy) { const pr = this.prop(propId); if (!pr || pr.owner !== p.id) return this.fail('Not your property'); if (!['low', 'market', 'high'].includes(strategy)) return this.fail('Bad strategy'); pr.strategy = strategy; return this.ok('Rent strategy set'); }
    setInsured(p, propId, on) { const pr = this.prop(propId); if (!pr || pr.owner !== p.id) return this.fail('Not your property'); pr.insured = !!on; return this.ok(on ? 'Insured' : 'Insurance cancelled'); }
    takeMortgage(p, propId, amount) {
      const pr = this.prop(propId); if (!pr || pr.owner !== p.id) return this.fail('Not your property');
      amount = round(amount);
      const max = round(this.propertyValue(pr) * 0.8);
      if (amount > max) return this.fail(`Max loan is ${fmtMoney(max)} (80% of value)`);
      if (p.creditScore < 580) return this.fail('Credit score too low');
      const old = pr.mortgage ? pr.mortgage.balance : 0;
      if (amount <= old) return this.fail('New loan must exceed the current balance');
      const closing = round(amount * 0.015);
      const net = amount - old - closing;
      if (net <= 0) return this.fail('Nothing left after closing costs');
      this.setMortgage(pr, amount, this.mortgageRate(p), 360);
      p.cash += net; p.year.propExpenses += closing;
      this.logp(p, `${p.name} ${old ? 'refinances' : 'mortgages'} ${pr.name}: ${fmtMoney(amount)} at ${pr.mortgage.rate}%, ${fmtMoney(net)} cash out.`);
      return this.ok('Mortgage taken');
    }
    refinance(p, propId) {
      const pr = this.prop(propId); if (!pr || pr.owner !== p.id || !pr.mortgage) return this.fail('No mortgage to refinance');
      const rate = this.mortgageRate(p);
      if (rate >= pr.mortgage.rate) return this.fail(`Current rate ${rate.toFixed(2)}% is not lower than ${pr.mortgage.rate}%`);
      const closing = round(pr.mortgage.balance * 0.015);
      if (p.cash < closing) return this.fail(`Need ${fmtMoney(closing)} for closing costs`);
      p.cash -= closing; p.year.propExpenses += closing;
      this.setMortgage(pr, pr.mortgage.balance, rate, 360);
      this.logp(p, `${p.name} refinances ${pr.name} at ${pr.mortgage.rate}%, closing ${fmtMoney(closing)}.`);
      return this.ok('Refinanced');
    }
    payMortgage(p, propId, amount) {
      const pr = this.prop(propId); if (!pr || pr.owner !== p.id || !pr.mortgage) return this.fail('No mortgage');
      amount = Math.min(round(amount), pr.mortgage.balance);
      if (amount <= 0 || p.cash < amount) return this.fail('Not enough cash');
      p.cash -= amount; pr.mortgage.balance -= amount;
      if (pr.mortgage.balance <= 0) { pr.mortgage = null; this.logp(p, `${p.name} pays off ${pr.name}.`, 'gain'); }
      else { pr.mortgage.payment = round(mortgagePayment(pr.mortgage.balance, pr.mortgage.rate, pr.mortgage.monthsLeft)); this.logp(p, `${p.name} pays ${fmtMoney(amount)} toward ${pr.name}.`); }
      return this.ok('Paid');
    }
    takeLoan(p, amount) {
      amount = round(amount);
      const cap = this.loanCapacity(p);
      if (amount <= 0 || amount > cap) return this.fail(`You can borrow up to ${fmtMoney(cap)}`);
      if (p.creditScore < 550) return this.fail('Credit score too low');
      const rate = this.loanRate(p);
      p.loans.push({ name: 'Personal loan', balance: amount, rate: Math.round(rate * 100) / 100, payment: round(mortgagePayment(amount, rate, 60)), monthsLeft: 60 });
      p.cash += amount;
      this.logp(p, `${p.name} takes a ${fmtMoney(amount)} personal loan at ${rate.toFixed(2)}%.`);
      return this.ok('Loan taken');
    }
    repayLoan(p, idx, amount) {
      const l = p.loans[idx]; if (!l) return this.fail('No such loan');
      amount = Math.min(round(amount), l.balance);
      if (amount <= 0 || p.cash < amount) return this.fail('Not enough cash');
      p.cash -= amount; l.balance -= amount;
      if (l.balance <= 0) { p.loans.splice(idx, 1); this.logp(p, `${p.name} pays off the ${l.name.toLowerCase()}.`, 'gain'); }
      else { l.payment = round(mortgagePayment(l.balance, l.rate, l.monthsLeft)); this.logp(p, `${p.name} repays ${fmtMoney(amount)} of the ${l.name.toLowerCase()}.`); }
      return this.ok('Repaid');
    }
    payDebt(p, amount) {
      amount = Math.min(round(amount), p.debt);
      if (amount <= 0 || p.cash < amount) return this.fail('Not enough cash');
      p.cash -= amount; p.debt -= amount;
      this.logp(p, `${p.name} pays ${fmtMoney(amount)} on the credit line.`);
      return this.ok('Paid');
    }
    buyStocks(p, dollars) {
      dollars = round(dollars);
      const fee = p.freeTrade ? 0 : round(dollars * D.COSTS.stockFee);
      if (dollars <= 0 || p.cash < dollars + fee) return this.fail('Not enough cash');
      p.cash -= dollars + fee; p.stocks += dollars / this.eco.stockIndex; p.stockBasis += dollars;
      this.logp(p, `${p.name} buys ${fmtMoney(dollars)} of the index fund.`);
      return this.ok('Bought');
    }
    sellStocks(p, dollars, forced) {
      const value = this.stocksValue(p);
      dollars = Math.min(round(dollars), value);
      if (dollars <= 0) return this.fail('Nothing to sell');
      const frac = dollars / value;
      const basis = p.stockBasis * frac;
      const gain = dollars - basis;
      const fee = p.freeTrade || forced ? 0 : round(dollars * D.COSTS.stockFee);
      let tax = 0; p.stats.gains += gain;
      if (gain > 0) { tax = round(gain * D.TAX.capitalGains * this.taxMult()); p.stats.taxes += tax; p.year.gains += gain; }
      p.stocks -= p.stocks * frac; if (p.stocks < 1e-9) p.stocks = 0;
      p.stockBasis -= basis; p.cash += dollars - fee - tax;
      this.logp(p, `${p.name} sells ${fmtMoney(dollars)} of the index fund${tax ? ` (capital gains tax ${fmtMoney(tax)})` : ''}.`);
      return this.ok('Sold');
    }
    setHealthInsurance(p, on) {
      if (this.policy.universalHealth) return this.fail('Everyone is covered by public health insurance');
      if (on && p.cash < this.healthPremium(p)) return this.fail('Not enough cash for the first premium');
      p.healthInsurance = !!on;
      this.logp(p, `${p.name} ${on ? 'enrolls in' : 'drops'} health insurance (${fmtMoney(this.healthPremium(p))}/month).`);
      return this.ok(on ? 'Enrolled' : 'Dropped');
    }

    /* ---------- persistence ---------- */
    toJSON() {
      const keys = ['cfg', 'seed', 'month', 'over', 'turnIndex', 'log', 'news', 'eco', 'activeEvents', 'eventCooldown', 'firedOnce', 'districtShift', 'scheduled', 'properties', 'players'];
      const o = {}; keys.forEach(k => { o[k] = this[k]; });
      o.winner = this.winner ? this.winner.id : null;
      return o;
    }
    static fromJSON(o) {
      const gm = new Game(Object.assign({}, o.cfg, { seed: Math.floor(Math.random() * 2147483647) }));
      ['month', 'over', 'turnIndex', 'log', 'news', 'eco', 'activeEvents', 'eventCooldown', 'firedOnce', 'districtShift', 'scheduled', 'properties', 'players'].forEach(k => { gm[k] = o[k]; });
      gm.winner = o.winner === null ? null : gm.players[o.winner];
      return gm;
    }
  }

  g.GameEngine = { Game, fmtMoney, mortgagePayment, clamp, MONTHS, BOARD_SIZE };
})(typeof window !== 'undefined' ? window : globalThis);
