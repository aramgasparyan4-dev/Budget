/* Real Estate Capital — heuristic AI controller */
(function (g) {
  'use strict';
  const D = g.GAME_DATA;

  function reserve(game, p) {
    return Math.max(8000, game.monthlyObligations(p) * 3);
  }
  function wantsProperty(game, p, pr, price, pct) {
    const value = game.propertyValue(pr);
    if (price > value * 1.06) return false;
    const risk = p.persona.risk;
    const loan = price * pct;
    const closing = price * D.COSTS.closingCost;
    const need = price - loan + closing;
    if (p.cash - need < reserve(game, p) * (1.5 - risk)) return false;
    const rent = game.grossRent(Object.assign({}, pr, { owner: p.id })) * game.targetOccupancy(pr);
    const costs = value * (D.COSTS.maintenanceRate + D.TAX.propertyTaxRate) / 12 + (loan ? g.GameEngine.mortgagePayment(loan, game.mortgageRate(p), 360) : 0);
    const net = rent - costs;
    // accept slightly negative cashflow in a boom (appreciation play) if risk-tolerant
    const tolerance = game.eco.cycle === 'recession' ? 0 : -value * 0.0015 * risk;
    if (net < tolerance) return false;
    // bias toward completing a district
    return true;
  }
  function districtScore(game, p, pr) {
    const mine = game.properties.filter(x => x.district === pr.district && x.owner === p.id).length;
    return mine;
  }

  function manage(game, p) {
    const res = () => reserve(game, p);
    const risk = p.persona.risk;
    // health insurance
    if (!p.healthInsurance && p.cash > 12000 && (risk < 0.75 || p.age > 40 || p.health < 65)) game.setHealthInsurance(p, true);
    // emergency: negative cash
    if (p.cash < 0) {
      if (p.stocks > 0) game.sellStocks(p, Math.min(game.stocksValue(p), -p.cash + 2000));
      if (p.cash < 0) {
        const props = game.playerProperties(p).sort((a, b) => game.equity(a) - game.equity(b));
        for (const pr of props) { if (p.cash >= 0) break; if (game.equity(pr) > 0) { const max = Math.round(game.propertyValue(pr) * 0.8); if (!pr.mortgage || pr.mortgage.balance < max * 0.9) { game.takeMortgage(p, pr.id, max); } } }
        for (const pr of props) { if (p.cash >= 0) break; game.quickSale(p, pr.id); }
      }
    }
    // pay expensive debt
    if (p.debt > 0 && p.cash > res() + p.debt * 0.5) game.payDebt(p, Math.min(p.debt, p.cash - res()));
    // properties upkeep
    game.playerProperties(p).forEach(pr => {
      const v = game.propertyValue(pr);
      if (pr.condition < 55 && p.cash - game.repairCost(pr) > res() * 0.8) game.repair(p, pr.id);
      if (!pr.insured && v > 400000 && p.cash > res()) game.setInsured(p, pr.id, true);
      if (pr.occupancy < 0.7 && pr.strategy !== 'low') game.setStrategy(p, pr.id, 'low');
      else if (pr.occupancy > 0.97 && pr.strategy === 'low') game.setStrategy(p, pr.id, 'market');
      if (pr.mortgage && game.mortgageRate(p) < pr.mortgage.rate - 1 && p.cash > res() + pr.mortgage.balance * 0.015) game.refinance(p, pr.id);
      if (pr.renovation < 3 && game.eco.cycle !== 'recession' && p.cash - game.renovateCost(pr) > res() * 2 && risk > 0.4) game.renovate(p, pr.id);
    });
    // buy something from the market (one per turn)
    if (p.cash > res() * 1.5) {
      const pct = p.creditScore >= 620 ? (risk > 0.5 ? 0.8 : 0.6) : 0;
      const candidates = [];
      game.properties.forEach(pr => {
        if (pr.owner === null) { const price = Math.round(game.marketPrice(pr) * (1 + D.COSTS.offMarketPremium)); if (wantsProperty(game, p, pr, price, pct)) candidates.push({ pr, price, listed: false }); }
        else if (pr.listedPrice !== null && pr.owner !== p.id) { if (wantsProperty(game, p, pr, pr.listedPrice, pct)) candidates.push({ pr, price: pr.listedPrice, listed: true }); }
      });
      if (candidates.length) {
        candidates.sort((a, b) => (districtScore(game, p, b.pr) - districtScore(game, p, a.pr)) || (b.price - a.price));
        const c = candidates[0];
        if (c.listed) game.buyListed(p, c.pr.id, pct); else game.buyProperty(p, c.pr.id, pct);
      }
    }
    // stocks with surplus
    const surplus = p.cash - res() * 2 - 15000;
    if (surplus > 5000 && game.eco.cycle !== 'peak') game.buyStocks(p, Math.round(surplus * (0.3 + 0.4 * risk)));
    if (game.eco.cycle === 'peak' && p.stocks > 0 && risk < 0.5) game.sellStocks(p, game.stocksValue(p) * 0.5);
    // list a property for sale if cash tight and over-leveraged
    if (p.cash < res() * 0.5 && game.playerProperties(p).length > 1) {
      const worst = game.playerProperties(p).sort((a, b) => game.netMonthlyCashflow(a) - game.netMonthlyCashflow(b))[0];
      if (worst && worst.listedPrice === null && game.netMonthlyCashflow(worst) < 0) game.listProperty(p, worst.id, Math.round(game.propertyValue(worst) * 1.02));
    }
    // unlist if comfortable
    game.playerProperties(p).forEach(pr => { if (pr.listedPrice !== null && p.cash > res() * 3) game.unlistProperty(p, pr.id); });
  }

  function decide(game, p, spec) {
    const risk = p.persona.risk;
    const enabled = spec.options.filter(o => !o.disabled);
    const has = id => enabled.some(o => o.id === id);
    switch (spec.type) {
      case 'buy': {
        const pr = game.prop(spec.propertyId);
        const price = game.marketPrice(pr);
        if (has('mortgage') && wantsProperty(game, p, pr, price, 0.8)) return 'mortgage';
        if (has('cash') && wantsProperty(game, p, pr, price, 0) && p.cash > price * 1.3 + reserve(game, p)) return 'cash';
        return 'pass';
      }
      case 'casino': {
        if (risk > 0.8 && has('5000') && p.cash > 60000) return '5000';
        if (risk > 0.65 && has('1000') && p.cash > 20000) return '1000';
        return '0';
      }
      case 'airport': {
        if (p.health < 60 && has('vacation')) return 'vacation';
        if (has('business') && p.cash > 10000) return 'business';
        return 'stay';
      }
      case 'bank': return has('consolidate') ? 'consolidate' : 'none';
      case 'job': {
        if (has('accept')) return p.cash > p.salary * 2 ? 'accept' : 'decline';
        if (has('pay')) return p.cash > 20000 ? 'pay' : 'skip';
        return enabled[0].id;
      }
      case 'life': {
        if (has('lend')) return p.cash > 30000 && risk > 0.4 ? 'lend' : 'decline';
        if (has('invest') && spec.text.includes('biotech')) return risk > 0.7 && p.cash > 60000 ? 'invest' : 'pass';
        if (has('invest')) return p.cash > 40000 ? 'invest' : 'pass';
        if (has('trainer')) return p.cash > 8000 ? 'trainer' : 'ignore';
        return enabled[0].id;
      }
      case 'offer': {
        const pr = game.prop(spec.propertyId);
        const value = game.propertyValue(pr);
        const distressed = p.cash < 0 || p.inDefault;
        const threshold = distressed ? 0.92 : (1.08 + risk * 0.1);
        return spec.price >= value * threshold ? 'accept' : 'decline';
      }
      default: return enabled.length ? enabled[0].id : spec.options[0].id;
    }
  }

  class AIController {
    constructor(game, opts) { this.game = game; this.opts = opts || {}; }
    async delay() { if (this.opts.delay) await this.opts.delay(); }
    async preRoll(p) { manage(this.game, p); this.game.emit('change'); await this.delay(); }
    async postRoll(p) { manage(this.game, p); this.game.emit('change'); await this.delay(); }
    async decide(p, spec) { const r = decide(this.game, p, spec); if (spec.type !== 'notice' && this.opts.onDecision) this.opts.onDecision(p, spec, r); await this.delay(); return r; }
    async skipped() { await this.delay(); }
  }

  g.GameAI = { AIController, manage, decide };
})(typeof window !== 'undefined' ? window : globalThis);
