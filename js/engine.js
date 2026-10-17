/* Real Estate Capital v2 — engine. A state machine: state + dispatch(action). No DOM. Deterministic given the seed. */
(function (g) {
  'use strict';
  const D = g.GAME_DATA;
  const N = 40;
  const round = v => Math.round(v);
  const fmt = (n, short) => {
    if (n === null || n === undefined || isNaN(n)) return '-';
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (short && n >= 1e6) s = '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    else if (short && n >= 1e4) s = '$' + Math.round(n / 1e3) + 'k';
    else s = '$' + Math.round(n).toLocaleString('en-US');
    return neg ? '-' + s : s;
  };

  function rand(st) {
    st.rng = (st.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(st.rng ^ (st.rng >>> 15), 1 | st.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rint = (st, a, b) => a + Math.floor(rand(st) * (b - a + 1));
  function shuffle(st, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(st) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  class Game {
    constructor(cfg) {
      const seed = cfg.seed === undefined || cfg.seed === null || cfg.seed === '' ? Math.floor(Math.random() * 2147483647) : Number(cfg.seed) >>> 0;
      const st = this.state = {
        cfg: Object.assign({ rounds: 24, explain: true }, cfg, { seed }),
        rng: seed, round: 1, turn: 0, queue: [], over: false, winner: null,
        priceMult: 1, effects: [], log: [], news: [],
        players: cfg.players.map((pc, i) => ({ id: i, name: pc.name || `Player ${i + 1}`, token: pc.token || D.TOKENS[i % D.TOKENS.length], color: D.COLORS[i % D.COLORS.length], isAI: !!pc.isAI,
          bg: null, cash: 0, salary: 0, insured: false, debt: 0, loan: 0, credit: 0, position: 0, hospital: 0, laidOff: false, laps: 0, doubles: 0, bankrupt: false,
          stats: { tax: 0, rentPaid: 0, rentGot: 0, medical: 0, wages: 0, interest: 0 }, startNW: 0, history: [] })),
        auction: null, lastOffer: {},
        props: {},
        decks: { life: [], world: [] },
      };
      D.BOARD.forEach((sq, i) => { if (sq.kind === 'property') st.props[i] = { owner: null, houses: 0, mortgaged: false }; });
      st.decks.life = shuffle(st, D.LIFE.map(c => c.id));
      st.decks.world = shuffle(st, D.WORLD.map(c => c.id));
      // pre-roll the wheel so spins are deterministic and backgrounds are unique while possible
      const bgs = shuffle(st, D.BACKGROUNDS.map(b => b.id));
      st.wheel = st.players.map((p, i) => bgs[i % bgs.length]);
      st.queue.push({ type: 'spin', playerId: 0 });
      this.listeners = [];
      this.log(`Game begins: ${st.players.length} players, ${st.cfg.rounds} rounds. Spin the wheel to find out who you are.`);
    }
    onChange(fn) { this.listeners.push(fn); }
    emit() { this.listeners.forEach(f => { try { f(this.state); } catch (e) { console.error(e); } }); }

    /* ---------- helpers ---------- */
    get st() { return this.state; }
    get pending() { return this.state.queue[0] || null; }
    player(id) { return this.state.players[id]; }
    current() { return this.state.players[this.state.turn]; }
    sq(i) { return D.BOARD[i]; }
    prop(i) { return this.state.props[i]; }
    active() { return this.state.players.filter(p => !p.bankrupt); }
    log(text, kind, playerId) { const e = { text, kind: kind || 'info', playerId: playerId === undefined ? null : playerId, round: this.state.round }; this.state.log.push(e); if (this.state.log.length > 400) this.state.log.shift(); }
    effect(key, dflt) { let v = dflt; this.state.effects.forEach(e => { if (e[key] !== undefined) v = e[key]; }); return v; }
    price(i) { return round(this.sq(i).price * this.state.priceMult / 1000) * 1000; }
    houseCost(i) { return round(this.sq(i).house * this.state.priceMult * this.effect('buildMult', 1) / 1000) * 1000; }
    ownsGroup(playerId, group) { return D.BOARD.every((s, i) => s.group !== group || (this.prop(i).owner === playerId)); }
    groupSquares(group) { return D.BOARD.map((s, i) => s.group === group ? i : -1).filter(i => i >= 0); }
    rent(i, dice) {
      const sq = this.sq(i), pr = this.prop(i);
      if (pr.owner === null || pr.mortgaged) return 0;
      let r;
      if (sq.group === 'transport') { const n = this.groupSquares('transport').filter(j => this.prop(j).owner === pr.owner).length; r = sq.rents[n - 1] * this.effect('transportMult', 1); }
      else { r = sq.rents[pr.houses]; if (pr.houses === 0 && this.ownsGroup(pr.owner, sq.group)) r *= 2; }
      r = r * this.state.priceMult * this.effect('rentMult', 1);
      return round(r / 100) * 100;
    }
    propValue(i) { const pr = this.prop(i); return (pr.mortgaged ? this.price(i) / 2 : this.price(i)) + pr.houses * this.houseCost(i) / 2; }
    propsOf(id) { return Object.keys(this.state.props).map(Number).filter(i => this.prop(i).owner === id); }
    netWorth(p) { if (p.bankrupt) return 0; let nw = p.cash - p.debt - p.loan; this.propsOf(p.id).forEach(i => { nw += this.propValue(i); }); return round(nw); }
    liquid(p) { let v = p.cash + (p.credit - p.loan); this.propsOf(p.id).forEach(i => { const pr = this.prop(i); v += pr.houses * this.houseCost(i) / 2; if (!pr.mortgaged) v += this.price(i) / 2; }); return v; }
    incomeTax(salary) { let tax = 0, prev = 0; for (const [cap, rate] of D.TAX.brackets) { if (salary > prev) tax += (Math.min(salary, cap) - prev) * rate; prev = cap; } return round(tax * this.effect('taxMult', 1)); }
    canBuild(id, i) { const sq = this.sq(i), pr = this.prop(i); return sq.group !== 'transport' && pr.owner === id && !pr.mortgaged && pr.houses < 5 && this.ownsGroup(id, sq.group) && !this.groupSquares(sq.group).some(j => this.prop(j).mortgaged); }

    push(item) { this.state.queue.push(item); }
    unshift(item) { this.state.queue.unshift(item); }
    notice(playerId, title, text, opts) { this.push(Object.assign({ type: 'notice', playerId, title, text }, opts || {})); }

    /* ---------- dispatch ---------- */
    dispatch(action) {
      const r = this._dispatch(action);
      if (r.ok) this.emit();
      return r;
    }
    _dispatch(a) {
      const st = this.state, q = this.pending;
      if (st.over) return { ok: false, msg: 'Game over' };
      if (!q) return { ok: false, msg: 'Nothing pending' };
      const p = st.players[a.playerId];
      const manageOK = q.type === 'turn' || q.type === 'endTurn' || q.type === 'debt';
      switch (a.type) {
        case 'spin': if (q.type !== 'spin' || q.playerId !== a.playerId) return this.fail(); return this.doSpin(p);
        case 'roll': if ((q.type !== 'turn' && q.type !== 'hospital') || q.playerId !== a.playerId) return this.fail(); return this.doRoll(p);
        case 'hospitalPay': if (q.type !== 'hospital' || q.playerId !== a.playerId) return this.fail(); return this.doHospitalPay(p);
        case 'buy': if (q.type !== 'buy' || q.playerId !== a.playerId) return this.fail(); return this.doBuy(p, q.square);
        case 'pass': if (q.type !== 'buy' || q.playerId !== a.playerId) return this.fail(); st.queue.shift(); this.log(`${p.name} passes on ${this.sq(q.square).name}.`, 'info', p.id); this.startAuction(q.square, p.id); return this.ok();
        case 'bid': if (q.type !== 'bid' || q.playerId !== a.playerId) return this.fail(); return this.doBid(p, a.amount || 0);
        case 'loan': if (!manageOK || q.playerId !== a.playerId) return this.fail(); return this.doLoan(p, a.amount);
        case 'repayLoan': if (!manageOK || q.playerId !== a.playerId || q.type === 'debt') return this.fail(); return this.doRepay(p, a.amount);
        case 'ack': if ((q.type !== 'notice' && q.type !== 'card') || q.playerId !== a.playerId) return this.fail(); st.queue.shift(); this.afterLanding(); return this.ok();
        case 'endTurn': if (q.type !== 'endTurn' || q.playerId !== a.playerId) return this.fail(); st.queue.shift(); this.nextTurn(); return this.ok();
        case 'build': if (!manageOK || q.playerId !== a.playerId || q.type === 'debt') return this.fail(); return this.doBuild(p, a.square);
        case 'sellHouse': if (!manageOK || q.playerId !== a.playerId) return this.fail(); return this.doSellHouse(p, a.square);
        case 'mortgage': if (!manageOK || q.playerId !== a.playerId) return this.fail(); return this.doMortgage(p, a.square);
        case 'unmortgage': if (!manageOK || q.playerId !== a.playerId || q.type === 'debt') return this.fail(); return this.doUnmortgage(p, a.square);
        case 'insurance': if (!manageOK || q.playerId !== a.playerId || q.type === 'debt') return this.fail(); p.insured = !!a.on; this.log(`${p.name} ${p.insured ? 'takes out' : 'cancels'} health insurance.`, 'info', p.id); return this.ok();
        case 'payDebt': if (q.type !== 'debt' || q.playerId !== a.playerId) return this.fail(); return this.doPayDebt(p);
        case 'bankrupt': if (q.type !== 'debt' || q.playerId !== a.playerId) return this.fail(); return this.doBankrupt(p, q);
        case 'offerTrade': if (!manageOK || q.playerId !== a.playerId || q.type === 'debt') return this.fail(); return this.doOffer(p, a);
        case 'acceptTrade': if (q.type !== 'trade' || q.toId !== a.playerId) return this.fail(); return this.doAccept(q);
        case 'declineTrade': if (q.type !== 'trade' || q.toId !== a.playerId) return this.fail(); st.queue.shift(); this.log(`${this.player(q.toId).name} declines ${this.player(q.fromId).name}'s offer.`, 'info', q.toId); return this.ok();
        default: return this.fail('Unknown action');
      }
    }
    ok(msg) { return { ok: true, msg: msg || '' }; }
    fail(msg) { return { ok: false, msg: msg || 'Not allowed right now' }; }

    /* ---------- setup: the wheel ---------- */
    doSpin(p) {
      const st = this.state;
      const bg = D.BACKGROUNDS.find(b => b.id === st.wheel[p.id]);
      p.bg = bg.id; p.cash = bg.cash; p.salary = bg.salary; p.insured = !!bg.insured; p.debt = bg.debt || 0; p.credit = bg.credit || 0;
      let inherited = 0;
      (bg.inherit || []).forEach(group => {
        const free = this.groupSquares(group).filter(i => this.prop(i).owner === null);
        if (!free.length) return;
        const i = free[0]; this.prop(i).owner = p.id; if (bg.mortgaged) this.prop(i).mortgaged = true; inherited += this.price(i);
      });
      let estate = 0;
      if (inherited > D.TAX.estateExemption) { estate = round((inherited - D.TAX.estateExemption) * D.TAX.estateRate); p.cash -= estate; p.stats.tax += estate; }
      p.startNW = this.netWorth(p);
      st.queue.shift();
      this.log(`${p.name} spins the wheel: ${bg.title}. ${bg.desc}`, 'spin', p.id);
      const lines = [`Cash ${fmt(p.cash)}`, `Salary ${fmt(p.salary)} a year`, p.insured ? 'Health insurance: yes' : 'Health insurance: none'];
      if (inherited) lines.push(`Inherited property worth ${fmt(inherited)}${estate ? ` (estate tax paid: ${fmt(estate)})` : ''}${bg.mortgaged ? ', mortgaged' : ''}`);
      if (p.debt) lines.push(`Student loan ${fmt(p.debt)}, taken from your first payday`);
      lines.push(`The bank will lend you up to ${fmt(p.credit)}`);
      this.notice(p.id, `${bg.icon} ${bg.title}`, bg.desc, { lines, real: bg.real, explain: 'spin', bg: bg.id });
      const next = st.players.find(x => x.id > p.id);
      if (next) this.push({ type: 'spin', playerId: next.id });
      else { this.log('Everyone has a life. Let the game begin.'); this.startTurn(); }
      return this.ok();
    }

    /* ---------- turns ---------- */
    startTurn() {
      const st = this.state, p = this.current();
      p.doubles = 0;
      if (p.hospital > 0) this.push({ type: 'hospital', playerId: p.id, turn: p.hospital });
      else this.push({ type: 'turn', playerId: p.id });
    }
    nextTurn() {
      const st = this.state;
      let i = st.turn, tries = 0;
      do { i = (i + 1) % st.players.length; tries++; if (i === 0) this.endRound(); } while (st.players[i].bankrupt && tries < st.players.length);
      if (st.over) return;
      st.turn = i;
      this.startTurn();
    }
    endRound() {
      const st = this.state;
      st.players.forEach(p => p.history.push(this.netWorth(p)));
      st.effects = st.effects.filter(e => { e.rounds--; if (e.rounds <= 0) { this.log(`${e.title} ends.`, 'world'); return false; } return true; });
      st.round++;
      if (st.round > st.cfg.rounds) this.finish();
    }
    finish() {
      const st = this.state; st.over = true; st.queue = [{ type: 'over' }];
      const rank = this.ranking(); st.winner = rank[0] ? rank[0].id : null;
      this.log(`Game over. ${rank[0] ? rank[0].name + ' finishes with the highest net worth: ' + fmt(this.netWorth(rank[0])) : 'Nobody survived.'}`, 'news');
    }
    ranking() { return this.state.players.slice().sort((a, b) => (b.bankrupt ? 0 : 1) - (a.bankrupt ? 0 : 1) || this.netWorth(b) - this.netWorth(a)); }
    checkEnd() { if (this.active().length <= 1 && this.state.players.length > 1) { this.finish(); return true; } return false; }

    doRoll(p) {
      const st = this.state, q = st.queue.shift();
      const d1 = rint(st, 1, 6), d2 = rint(st, 1, 6), doubles = d1 === d2;
      st.dice = [d1, d2];
      if (q.type === 'hospital') {
        if (doubles) { p.hospital = 0; this.log(`${p.name} rolls doubles (${d1}+${d2}) and leaves Hospital.`, 'info', p.id); this.move(p, d1 + d2, false); }
        else {
          p.hospital++;
          if (p.hospital > 3) { const bill = p.insured ? D.COSTS.hospitalBillInsured : D.COSTS.hospitalBill; this.log(`${p.name} has been in Hospital three turns and must pay the ${fmt(bill)} bill.`, 'info', p.id); p.hospital = 0; this.charge(p, bill, null, 'medical'); this.notice(p.id, 'Discharged', `Three turns in Hospital. You pay the bill of ${fmt(bill)} and leave.`); this.move(p, d1 + d2, false); }
          else { this.log(`${p.name} rolls ${d1}+${d2}, no doubles, and stays in Hospital.`, 'info', p.id); this.notice(p.id, 'Still in Hospital', `No doubles. Turn ${p.hospital} of 3 in Hospital.`); this.push({ type: 'endTurn', playerId: p.id }); }
        }
        return this.ok();
      }
      if (doubles) p.doubles++;
      if (p.doubles === 3) { this.log(`${p.name} rolls doubles three times: exhaustion. Off to Hospital.`, 'warn', p.id); this.toHospital(p, 'Three doubles in a row. You collapse from exhaustion and wake up in Hospital.'); this.push({ type: 'endTurn', playerId: p.id }); return this.ok(); }
      this.log(`${p.name} rolls ${d1}+${d2}${doubles ? ' (doubles)' : ''}.`, 'info', p.id);
      this.move(p, d1 + d2, doubles);
      return this.ok();
    }
    move(p, steps, again) {
      const from = p.position, to = (from + steps) % N;
      if (to < from) this.payday(p);
      p.position = to;
      this.state.lastMove = { playerId: p.id, from, to };
      this.land(p, steps);
      this.push({ type: again && p.hospital === 0 ? 'turn' : 'endTurn', playerId: p.id, again: !!again });
    }
    payday(p) {
      const st = this.state;
      p.laps++;
      let gross = p.salary * this.effect('salaryNext', 1);
      const effIdx = st.effects.findIndex(e => e.salaryNext !== undefined); if (effIdx >= 0) delete st.effects[effIdx].salaryNext;
      const lines = [];
      if (p.laidOff) { gross = D.COSTS.unemployment; p.laidOff = false; lines.push(`Unemployment benefit ${fmt(gross)} (you were laid off)`); } else lines.push(`Salary ${fmt(gross)}`);
      const tax = this.incomeTax(gross); lines.push(`Income tax -${fmt(tax)}`);
      let net = gross - tax;
      if (p.insured) { net -= D.COSTS.premium; lines.push(`Health insurance -${fmt(D.COSTS.premium)}`); }
      if (p.debt > 0) { const pay = Math.min(p.debt, net); net -= pay; p.debt -= pay; lines.push(`Student loan repayment -${fmt(pay)}`); }
      if (p.loan > 0) { const interest = round(p.loan * D.COSTS.loanRate); net -= interest; p.stats.interest += interest; lines.push(`Interest on ${fmt(p.loan)} bank loan -${fmt(interest)}`); }
      p.stats.tax += tax; p.stats.wages += gross;
      if (net < 0) { this.charge(p, -net, null, 'interest'); } else p.cash += net;
      this.log(`${p.name} passes Payday: ${fmt(gross)} salary, ${fmt(tax)} tax, keeps ${fmt(net)}.`, 'payday', p.id);
      this.notice(p.id, '💵 Payday', `Another year. You take home ${fmt(net)}.`, { lines, explain: 'payday' });
    }
    land(p, dice) {
      const i = p.position, sq = this.sq(i);
      switch (sq.kind) {
        case 'property': return this.landProperty(p, i, dice);
        case 'life': return this.drawCard(p, 'life');
        case 'world': return this.drawCard(p, 'world');
        case 'tax': { let v = 0; this.propsOf(p.id).forEach(j => { v += this.price(j) + this.prop(j).houses * this.houseCost(j); }); const tax = Math.max(D.TAX.propertyTaxMin, round(v * D.TAX.propertyTaxRate / 100) * 100); this.charge(p, tax, null, 'tax'); this.notice(p.id, '🧾 Property tax', `You pay ${fmt(tax)}: 1% of the ${fmt(v)} of property you own${v === 0 ? ' (the minimum, since you own nothing)' : ''}.`, { explain: 'tax' }); return; }
        case 'wealth': { const nw = this.netWorth(p); const tax = nw > D.TAX.wealthTaxThreshold ? round(nw * D.TAX.wealthTaxRate / 100) * 100 : 0; if (tax) this.charge(p, tax, null, 'tax'); this.notice(p.id, '💎 Wealth tax', tax ? `Your net worth is ${fmt(nw)}, over $1,000,000. You pay 2%: ${fmt(tax)}.` : `Your net worth is ${fmt(nw)}, under $1,000,000. Nothing to pay. This tax is for the rich.`, { explain: 'wealth' }); return; }
        case 'hospital': this.notice(p.id, '🏥 Hospital', 'Just visiting.', { trivial: true }); return;
        case 'accident': this.toHospital(p, 'A fall on the stairs. Ambulance to Hospital.'); return;
        case 'dayoff': this.notice(p.id, '🌴 Day off', 'Nothing happens. Enjoy it.', { trivial: true }); return;
        case 'go': return;
      }
    }
    toHospital(p, why) {
      p.position = 10; p.hospital = 1; p.doubles = 0;
      this.log(`${p.name} goes to Hospital.`, 'warn', p.id);
      this.notice(p.id, '🚑 Hospital', `${why} Pay ${fmt(p.insured ? D.COSTS.hospitalBillInsured : D.COSTS.hospitalBill)} to leave${p.insured ? ' (you are insured)' : ' (no insurance)'}, or roll doubles.`, { explain: 'hospital' });
    }
    doHospitalPay(p) {
      const st = this.state; st.queue.shift();
      const bill = p.insured ? D.COSTS.hospitalBillInsured : D.COSTS.hospitalBill;
      p.hospital = 0; this.charge(p, bill, null, 'medical');
      this.log(`${p.name} pays ${fmt(bill)} and leaves Hospital.`, 'info', p.id);
      const d1 = rint(st, 1, 6), d2 = rint(st, 1, 6); st.dice = [d1, d2];
      this.log(`${p.name} rolls ${d1}+${d2}.`, 'info', p.id);
      this.move(p, d1 + d2, false);
      return this.ok();
    }
    landProperty(p, i, dice) {
      const sq = this.sq(i), pr = this.prop(i);
      if (pr.owner === null) {
        const price = this.price(i);
        if (p.cash >= price) this.push({ type: 'buy', playerId: p.id, square: i, price, explain: 'buy' });
        else if (p.cash + (p.credit - p.loan) >= price) this.push({ type: 'buy', playerId: p.id, square: i, price, explain: 'buy', needsLoan: price - p.cash });
        else { this.notice(p.id, sq.name, `For sale at ${fmt(price)}, but you only have ${fmt(p.cash)}${p.credit - p.loan > 0 ? ` and can borrow ${fmt(p.credit - p.loan)}` : ' and no credit'}. It goes to auction.`); this.startAuction(i, p.id); }
        return;
      }
      if (pr.owner === p.id) { this.notice(p.id, sq.name, 'Your own property. Nothing to pay.', { trivial: true }); return; }
      const owner = this.player(pr.owner);
      if (pr.mortgaged) { this.notice(p.id, sq.name, `${owner.name} owns this but it is mortgaged, so no rent is due.`, { trivial: true }); return; }
      const r = this.rent(i, dice);
      this.charge(p, r, owner, 'rent');
      p.stats.rentPaid += r; owner.stats.rentGot += r;
      this.log(`${p.name} pays ${fmt(r)} rent to ${owner.name} at ${sq.name}.`, 'rent', p.id);
      this.notice(p.id, `${sq.name}`, `${owner.name} owns this${pr.houses === 5 ? ' with a hotel' : pr.houses ? ` with ${pr.houses} house${pr.houses > 1 ? 's' : ''}` : ''}. You pay ${fmt(r)} rent.`, { explain: 'rentpaid', square: i });
      this.notice(owner.id, `${sq.name}`, `${p.name} landed on your property and paid you ${fmt(r)}.`, { explain: 'rentgot', passive: true });
    }
    doBuy(p, i) {
      const st = this.state, q = st.queue.shift();
      const price = this.price(i);
      if (p.cash < price) { const need = price - p.cash; if (need > p.credit - p.loan) return this.fail('Not enough cash or credit'); const amt = Math.ceil(need / D.COSTS.loanStep) * D.COSTS.loanStep; p.loan += amt; p.cash += amt; this.log(`${p.name} borrows ${fmt(amt)} from the bank to buy.`, 'deal', p.id); }
      p.cash -= price; this.prop(i).owner = p.id;
      this.log(`${p.name} buys ${this.sq(i).name} for ${fmt(price)}.`, 'deal', p.id);
      const sq = this.sq(i);
      if (sq.group !== 'transport' && this.ownsGroup(p.id, sq.group)) this.notice(p.id, `${D.GROUPS[sq.group].name} complete`, `You own all of ${D.GROUPS[sq.group].name}. Rents there are doubled and you can build houses.`, { explain: 'group' });
      this.afterLanding();
      return this.ok();
    }
    afterLanding() { /* queue continues on its own; hook for symmetry */ }

    /* ---------- auctions ---------- */
    startAuction(i, passerId) {
      const st = this.state;
      const bidders = this.active().filter(x => x.cash + (x.credit - x.loan) >= D.COSTS.auctionStep);
      if (bidders.length < 2 && !(bidders.length === 1 && bidders[0].id !== passerId)) return;
      st.auction = { square: i, bids: {}, passerId };
      this.log(`${this.sq(i).name} goes to auction.`, 'deal');
      // bids are sealed: everyone decides before anyone sees. Insert ahead of the endTurn item.
      const items = bidders.map(x => ({ type: 'bid', playerId: x.id, square: i, explain: 'auction', min: D.COSTS.auctionStep }));
      const idx = st.queue.findIndex(x => x.type === 'endTurn' || x.type === 'turn');
      if (idx < 0) st.queue.push(...items); else st.queue.splice(idx, 0, ...items);
    }
    doBid(p, amount) {
      const st = this.state, au = st.auction; if (!au) return this.fail('No auction');
      amount = Math.max(0, Math.floor(amount / D.COSTS.auctionStep) * D.COSTS.auctionStep);
      if (amount > p.cash + (p.credit - p.loan)) return this.fail(`You can bid at most ${fmt(p.cash + (p.credit - p.loan))}`);
      au.bids[p.id] = amount; st.queue.shift();
      if (st.queue.some(x => x.type === 'bid')) return this.ok();
      // resolve
      const entries = Object.entries(au.bids).map(([id, b]) => ({ id: Number(id), b })).filter(x => x.b > 0).sort((a, b) => b.b - a.b || a.id - b.id);
      const sq = this.sq(au.square);
      if (!entries.length) { this.log(`Nobody bids for ${sq.name}. It stays with the bank.`, 'deal'); st.auction = null; return this.ok(); }
      const w = this.player(entries[0].id), price = entries[0].b;
      if (w.cash < price) { const amt = Math.ceil((price - w.cash) / D.COSTS.loanStep) * D.COSTS.loanStep; w.loan += amt; w.cash += amt; this.log(`${w.name} borrows ${fmt(amt)} to pay for the auction.`, 'deal', w.id); }
      w.cash -= price; this.prop(au.square).owner = w.id;
      const lines = entries.map(e => `${this.player(e.id).name} bid ${fmt(e.b)}`);
      this.log(`${w.name} wins the auction for ${sq.name} at ${fmt(price)} (list price ${fmt(this.price(au.square))}).`, 'deal', w.id);
      this.active().forEach(x => { if (x.id === w.id || au.bids[x.id] > 0) this.notice(x.id, `Auction: ${sq.name}`, `${w.name} wins at ${fmt(price)}${price < this.price(au.square) ? `, a bargain against the ${fmt(this.price(au.square))} list price` : ''}.`, { lines, passive: x.id !== w.id }); });
      if (sq.group !== 'transport' && this.ownsGroup(w.id, sq.group)) this.notice(w.id, `${D.GROUPS[sq.group].name} complete`, `You own all of ${D.GROUPS[sq.group].name}. Rents there are doubled and you can build houses.`, { explain: 'group' });
      st.auction = null;
      return this.ok();
    }

    /* ---------- bank loans ---------- */
    doLoan(p, amount) {
      amount = Math.floor((amount || D.COSTS.loanStep) / D.COSTS.loanStep) * D.COSTS.loanStep;
      if (amount <= 0) return this.fail('Bad amount');
      if (p.loan + amount > p.credit) return this.fail(`The bank will only lend you ${fmt(p.credit - p.loan)} more`);
      p.loan += amount; p.cash += amount;
      this.log(`${p.name} borrows ${fmt(amount)} from the bank (${fmt(p.loan)} owed, 10% interest a year).`, 'deal', p.id);
      return this.ok('explain:loan');
    }
    doRepay(p, amount) {
      amount = Math.min(p.loan, Math.floor((amount || p.loan) / D.COSTS.loanStep) * D.COSTS.loanStep || p.loan);
      if (amount <= 0 || p.cash < amount) return this.fail('Not enough cash');
      p.loan -= amount; p.cash -= amount;
      this.log(`${p.name} repays ${fmt(amount)} to the bank.`, 'deal', p.id);
      return this.ok();
    }

    /* ---------- cards ---------- */
    drawCard(p, deck) {
      const st = this.state;
      const id = st.decks[deck].shift(); st.decks[deck].push(id);
      const c = (deck === 'life' ? D.LIFE : D.WORLD).find(x => x.id === id);
      const lines = [];
      if (deck === 'life') {
        if (c.cash !== undefined) { const amt = p.insured && c.insuredCash !== undefined ? c.insuredCash : c.cash; if (amt < 0) this.charge(p, -amt, null, 'life'); else p.cash += amt; lines.push(`${amt >= 0 ? '+' : '-'}${fmt(Math.abs(amt))}${p.insured && c.insuredCash !== undefined ? ' (insured)' : ''}`); }
        if (c.salaryPct) { p.salary = round(p.salary * (1 + c.salaryPct) / 1000) * 1000; lines.push(`Salary now ${fmt(p.salary)}`); }
        if (c.laidOff) { p.laidOff = true; lines.push(`Next payday: ${fmt(D.COSTS.unemployment)} unemployment instead of ${fmt(p.salary)}`); }
        if (c.repairs) { let n = 0; this.propsOf(p.id).forEach(i => { const h = this.prop(i).houses; n += h === 5 ? c.repairs[1] : h * c.repairs[0]; }); if (n) this.charge(p, n, null, 'life'); lines.push(n ? `Repairs -${fmt(n)}` : 'No houses, nothing to repair'); }
        this.log(`${p.name} draws Life: ${c.title}. ${lines.join('. ')}`, 'life', p.id);
        this.push({ type: 'card', playerId: p.id, deck, title: `🎴 ${c.title}`, text: c.text, lines, real: c.real, explain: 'life' });
        if (c.hospital) this.toHospital(p, 'Your condition is serious.');
        if (c.goto !== undefined) { this.payday(p); p.position = 0; }
        return;
      }
      // world card: everyone
      const active = this.active();
      if (c.rounds) st.effects.push({ title: c.title, rounds: c.rounds, rentMult: c.rentMult, taxMult: c.taxMult, buildMult: c.buildMult, transportMult: c.transportMult, salaryNext: c.salaryNext });
      if (c.priceMult) { st.priceMult = Math.round(st.priceMult * c.priceMult * 100) / 100; lines.push(`Prices now ${Math.round(st.priceMult * 100)}% of the original`); }
      if (c.cashPct) active.forEach(x => { const d = round(x.cash * c.cashPct / 100) * 100; x.cash += d; lines.push(`${x.name} ${d >= 0 ? '+' : '-'}${fmt(Math.abs(d))}`); });
      if (c.allPay) active.forEach(x => { const amt = x.insured ? c.allPay[1] : c.allPay[0]; this.charge(x, amt, null, 'medical'); lines.push(`${x.name} pays ${fmt(amt)}${x.insured ? ' (insured)' : ''}`); });
      if (c.damage) active.forEach(x => { const n = this.propsOf(x.id).filter(i => c.damage.groups.includes(this.sq(i).group)).length; if (n) { const amt = n * (x.insured ? c.damage.insuredPer : c.damage.per); if (amt) this.charge(x, amt, null, 'life'); lines.push(`${x.name}: ${n} propert${n > 1 ? 'ies' : 'y'} hit, pays ${fmt(amt)}${x.insured ? ' (insured)' : ''}`); } });
      if (c.mortgageFee) active.forEach(x => { let m = 0; this.propsOf(x.id).forEach(i => { if (this.prop(i).mortgaged) m += this.price(i) / 2; }); if (m) { const amt = round(m * c.mortgageFee); this.charge(x, amt, null, 'life'); lines.push(`${x.name} pays ${fmt(amt)} extra interest`); } });
      if (c.minWage) active.forEach(x => { if (x.salary < c.minWage) { lines.push(`${x.name}: salary ${fmt(x.salary)} → ${fmt(c.minWage)}`); x.salary = c.minWage; } });
      if (c.wealthTaxNow) active.forEach(x => { const nw = this.netWorth(x); if (nw > D.TAX.wealthTaxThreshold) { const amt = round(nw * D.TAX.wealthTaxRate / 100) * 100; this.charge(x, amt, null, 'tax'); lines.push(`${x.name} pays ${fmt(amt)}`); } else lines.push(`${x.name}: under $1M, pays nothing`); });
      this.log(`${p.name} draws World: ${c.title}. ${c.text}`, 'world', p.id);
      st.news.unshift({ round: st.round, title: c.title, text: c.text, real: c.real });
      this.push({ type: 'card', playerId: p.id, deck, title: `🌍 ${c.title}`, text: c.text, lines, real: c.real, explain: 'world', everyone: true });
    }

    /* ---------- money ---------- */
    charge(p, amount, creditor, kind) {
      amount = round(amount);
      if (kind === 'medical') p.stats.medical += amount;
      p.cash -= amount;
      if (creditor) creditor.cash += amount;
      if (p.cash < 0) {
        // must raise money before anything else happens
        this.unshift({ type: 'debt', playerId: p.id, amount: -p.cash, creditorId: creditor ? creditor.id : null, explain: 'debt' });
        this.log(`${p.name} is ${fmt(-p.cash)} short and must raise money.`, 'warn', p.id);
      }
    }
    doPayDebt(p) {
      const q = this.pending; if (p.cash < 0) return this.fail(`Still ${fmt(-p.cash)} short. Sell houses or mortgage properties.`);
      this.state.queue.shift(); this.log(`${p.name} covers the shortfall.`, 'info', p.id); return this.ok();
    }
    doBankrupt(p, q) {
      if (this.liquid(p) >= q.amount + p.cash + 0) { /* liquid includes cash; compare raisable vs owed */ }
      if (this.liquid(p) >= 0) return this.fail('You can still raise the money by selling houses or mortgaging.');
      const st = this.state; st.queue.shift();
      const cred = q.creditorId === null ? null : this.player(q.creditorId);
      this.propsOf(p.id).forEach(i => { const pr = this.prop(i); pr.houses = 0; if (cred) { pr.owner = cred.id; } else { pr.owner = null; pr.mortgaged = false; } });
      if (cred && p.cash > 0) cred.cash += p.cash;
      p.cash = 0; p.loan = 0; p.bankrupt = true;
      this.log(`${p.name} is bankrupt${cred ? `. Everything goes to ${cred.name}` : ''}.`, 'news', p.id);
      st.queue = st.queue.filter(x => x.playerId !== p.id || x.type === 'notice' || x.type === 'card');
      if (!this.checkEnd() && st.turn === p.id && !st.queue.some(x => x.type === 'endTurn')) this.push({ type: 'endTurn', playerId: p.id });
      return this.ok();
    }

    /* ---------- management ---------- */
    doBuild(p, i) {
      if (!this.canBuild(p.id, i)) return this.fail('You need the whole colour group, with nothing mortgaged');
      const cost = this.houseCost(i); if (p.cash < cost) return this.fail(`A house here costs ${fmt(cost)}`);
      p.cash -= cost; this.prop(i).houses++;
      this.log(`${p.name} builds ${this.prop(i).houses === 5 ? 'a hotel' : 'a house'} on ${this.sq(i).name} for ${fmt(cost)}.`, 'deal', p.id);
      return this.ok();
    }
    doSellHouse(p, i) {
      const pr = this.prop(i); if (pr.owner !== p.id || pr.houses === 0) return this.fail('No houses to sell');
      const v = this.houseCost(i) / 2; pr.houses--; p.cash += v;
      this.log(`${p.name} sells a house on ${this.sq(i).name} for ${fmt(v)}.`, 'deal', p.id);
      return this.ok();
    }
    doMortgage(p, i) {
      const pr = this.prop(i); if (pr.owner !== p.id || pr.mortgaged) return this.fail('Cannot mortgage');
      if (pr.houses > 0) return this.fail('Sell the houses first');
      if (this.sq(i).group !== 'transport' && this.groupSquares(this.sq(i).group).some(j => this.prop(j).owner === p.id && this.prop(j).houses > 0)) return this.fail('Sell houses in this colour group first');
      const v = this.price(i) / 2; pr.mortgaged = true; p.cash += v;
      this.log(`${p.name} mortgages ${this.sq(i).name} for ${fmt(v)}.`, 'deal', p.id);
      return this.ok('explain:mortgage');
    }
    doUnmortgage(p, i) {
      const pr = this.prop(i); if (pr.owner !== p.id || !pr.mortgaged) return this.fail('Not mortgaged');
      const cost = round(this.price(i) * 0.55); if (p.cash < cost) return this.fail(`Paying off the mortgage costs ${fmt(cost)}`);
      p.cash -= cost; pr.mortgaged = false;
      this.log(`${p.name} pays off the mortgage on ${this.sq(i).name} (${fmt(cost)}).`, 'deal', p.id);
      return this.ok();
    }
    doOffer(p, a) {
      const to = this.player(a.toId); if (!to || to.bankrupt || to.id === p.id) return this.fail('Bad trade partner');
      const give = a.give || { cash: 0, props: [] }, get = a.get || { cash: 0, props: [] };
      if (give.cash > p.cash || get.cash > to.cash) return this.fail('Not enough cash for that');
      if (give.props.some(i => this.prop(i).owner !== p.id || this.prop(i).houses) || get.props.some(i => this.prop(i).owner !== to.id || this.prop(i).houses)) return this.fail('Only properties without houses can be traded');
      if (!give.cash && !give.props.length && !get.cash && !get.props.length) return this.fail('Empty offer');
      this.state.lastOffer[`${p.id}-${to.id}`] = this.state.round;
      this.unshift({ type: 'trade', fromId: p.id, toId: to.id, give, get, explain: 'trade' });
      this.log(`${p.name} offers ${to.name} a trade.`, 'deal', p.id);
      return this.ok();
    }
    doAccept(q) {
      const from = this.player(q.fromId), to = this.player(q.toId);
      this.state.queue.shift();
      from.cash -= q.give.cash; to.cash += q.give.cash; to.cash -= q.get.cash; from.cash += q.get.cash;
      q.give.props.forEach(i => { this.prop(i).owner = to.id; }); q.get.props.forEach(i => { this.prop(i).owner = from.id; });
      this.log(`${to.name} accepts: ${this.describeTrade(q)}.`, 'deal', to.id);
      return this.ok();
    }
    describeTrade(q) {
      const side = (s) => [s.cash ? fmt(s.cash) : null].concat(s.props.map(i => this.sq(i).name)).filter(Boolean).join(' + ') || 'nothing';
      return `${this.player(q.fromId).name} gives ${side(q.give)} for ${side(q.get)}`;
    }

    /* ---------- persistence ---------- */
    toJSON() { return this.state; }
    static fromJSON(state) { const gm = Object.create(Game.prototype); gm.state = state; gm.listeners = []; return gm; }
  }

  g.GameEngine = { Game, fmt, N };
})(typeof window !== 'undefined' ? window : globalThis);
