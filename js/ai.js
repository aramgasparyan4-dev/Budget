/* Real Estate Capital v2 — computer players. Given the state and a pending decision, return one action. */
(function (g) {
  'use strict';
  const D = g.GAME_DATA;

  function reserve(game, p) { return 20000 + (p.insured ? 0 : 20000) + 2000 * game.propsOf(p.id).length + p.loan * 0.1; }
  function savingForHouses(game, p) { const b = game.propsOf(p.id).filter(i => game.canBuild(p.id, i)); return b.length ? game.houseCost(b[0]) : 0; }
  function groupInfo(game, p, group) {
    const sqs = game.groupSquares(group);
    return { sqs, mine: sqs.filter(i => game.prop(i).owner === p.id), others: sqs.filter(i => game.prop(i).owner !== null && game.prop(i).owner !== p.id), free: sqs.filter(i => game.prop(i).owner === null) };
  }
  function wantsSquare(game, p, i) {
    const sq = game.sq(i); if (sq.group === 'transport') return 1;
    const gi = groupInfo(game, p, sq.group);
    if (gi.mine.length === gi.sqs.length - 1) return 2.2;   // completes a group
    if (gi.mine.length > 0) return 1.5;
    if (gi.others.length === 0) return 1.1;
    return 0.8;
  }

  function proposeTrade(game, p) {
    const st = game.state;
    for (const group of Object.keys(D.GROUPS)) {
      if (group === 'transport') continue;
      const gi = groupInfo(game, p, group);
      if (gi.mine.length !== gi.sqs.length - 1 || gi.others.length !== 1) continue;
      const i = gi.others[0], pr = game.prop(i); if (pr.houses) continue;
      const to = game.player(pr.owner); if (to.bankrupt) continue;
      if (st.lastOffer[`${p.id}-${to.id}`] && st.round - st.lastOffer[`${p.id}-${to.id}`] < 3) continue;
      const price = game.price(i);
      // offer cash at 1.4x, or 1.1x plus a property from a group where we hold only one
      const spare = game.propsOf(p.id).filter(j => { const sq = game.sq(j); if (sq.group === 'transport' || game.prop(j).houses || game.prop(j).mortgaged) return false; return groupInfo(game, p, sq.group).mine.length === 1; });
      let give;
      if (spare.length && p.cash > price * 0.5 + reserve(game, p)) give = { cash: Math.round(price * 0.5 / 10000) * 10000, props: [spare[0]] };
      else if (p.cash > price * 1.4 + reserve(game, p)) give = { cash: Math.round(price * 1.4 / 10000) * 10000, props: [] };
      else continue;
      return { type: 'offerTrade', playerId: p.id, toId: to.id, give, get: { cash: 0, props: [i] } };
    }
    return null;
  }

  function manage(game, p) {
    if (!p.insured && p.cash > 50000) return { type: 'insurance', playerId: p.id, on: true };
    if (p.loan > 0 && p.loanRate >= 0.2 && p.cash >= 10000) return { type: 'repayLoan', playerId: p.id, amount: Math.min(p.loan, Math.floor(p.cash / 10000) * 10000) };
    if (p.loan > 0 && p.cash > p.loan + reserve(game, p) * 2) return { type: 'repayLoan', playerId: p.id, amount: Math.min(p.loan, Math.floor((p.cash - reserve(game, p) * 2) / 10000) * 10000) || p.loan };
    for (const i of game.propsOf(p.id)) { const pr = game.prop(i); if (pr.mortgaged && p.cash > game.price(i) * 0.55 + reserve(game, p) * 1.5) return { type: 'unmortgage', playerId: p.id, square: i }; }
    const buildable = game.propsOf(p.id).filter(i => game.canBuild(p.id, i)).sort((a, b) => game.prop(a).houses - game.prop(b).houses || game.houseCost(a) - game.houseCost(b));
    if (buildable.length) { const i = buildable[0]; if (p.cash - game.houseCost(i) > reserve(game, p) * 0.4) return { type: 'build', playerId: p.id, square: i }; }
    const t = proposeTrade(game, p); if (t) return t;
    if (p.cash > reserve(game, p) * 3 + 100000 && !savingForHouses(game, p)) return { type: 'invest', playerId: p.id, amount: Math.floor((p.cash - reserve(game, p) * 3) / 2 / 10000) * 10000 };
    return null;
  }

  function raise(game, p) {
    const need = -p.cash;
    if (p.invest >= 10000) return { type: 'cashOut', playerId: p.id, amount: Math.min(p.invest, Math.ceil(need / 10000) * 10000) };
    if (p.credit - p.loan >= 10000 && p.loanRate < 0.2) return { type: 'loan', playerId: p.id, amount: Math.min(p.credit - p.loan, Math.ceil(need / 10000) * 10000) };
    const withHouses = game.propsOf(p.id).filter(i => game.prop(i).houses > 0).sort((a, b) => game.prop(b).houses - game.prop(a).houses);
    if (withHouses.length) return { type: 'sellHouse', playerId: p.id, square: withHouses[0] };
    const mort = game.propsOf(p.id).filter(i => !game.prop(i).mortgaged).sort((a, b) => game.price(a) - game.price(b));
    if (mort.length) return { type: 'mortgage', playerId: p.id, square: mort[0] };
    if (p.credit - p.loan >= 10000) return { type: 'loan', playerId: p.id, amount: Math.min(p.credit - p.loan, Math.ceil(need / 10000) * 10000) };
    return { type: 'bankrupt', playerId: p.id };
  }

  function decide(game, q) {
    const p = game.player(q.playerId !== undefined ? q.playerId : q.toId);
    switch (q.type) {
      case 'spin': return { type: 'spin', playerId: p.id };
      case 'turn': { const m = manage(game, p); return m || { type: 'roll', playerId: p.id }; }
      case 'endTurn': { const m = manage(game, p); return m || { type: 'endTurn', playerId: p.id }; }
      case 'hospital': { const bill = p.insured ? D.COSTS.hospitalBillInsured : D.COSTS.hospitalBill; return p.cash > bill + reserve(game, p) || q.turn >= 3 ? { type: 'hospitalPay', playerId: p.id } : { type: 'roll', playerId: p.id }; }
      case 'buy': {
        const w = wantsSquare(game, p, q.square);
        const afford = p.cash + (w >= 2 && p.loanRate < 0.2 ? Math.max(0, p.credit - p.loan) : 0) - savingForHouses(game, p) * (w >= 2 ? 0 : 1);
        return { type: afford - q.price > reserve(game, p) / w ? 'buy' : 'pass', playerId: p.id };
      }
      case 'bid': {
        const w = wantsSquare(game, p, q.square), price = game.price(q.square);
        const max = Math.min(p.cash + (w >= 2 && p.loanRate < 0.2 ? Math.max(0, p.credit - p.loan) : 0) - reserve(game, p) * 0.5 - (w >= 2 ? 0 : savingForHouses(game, p)), price * (w >= 2 ? 1.3 : w >= 1.5 ? 0.9 : 0.6));
        const bid = Math.floor(Math.max(0, max) / 10000) * 10000;
        return { type: 'bid', playerId: p.id, amount: bid >= 10000 ? bid : 0 };
      }
      case 'notice': case 'card': return { type: 'ack', playerId: p.id };
      case 'debt': return p.cash >= 0 ? { type: 'payDebt', playerId: p.id } : raise(game, p);
      case 'trade': {
        const to = game.player(q.toId);
        const val = s => s.cash + s.props.reduce((t, i) => t + game.price(i) * (game.prop(i).mortgaged ? 0.5 : 1), 0);
        const completes = q.give.props.some(i => { const grp = game.sq(i).group; return game.groupSquares(grp).every(j => game.prop(j).owner === to.id || q.give.props.includes(j)); });
        const givesGroupPiece = q.get.props.some(i => { const grp = game.sq(i).group; return groupInfo(game, to, grp).mine.length >= 2; });
        const givesCompleter = q.get.props.some(i => { const grp = game.sq(i).group; const from = game.player(q.fromId); return groupInfo(game, from, grp).mine.length === game.groupSquares(grp).length - 1; });
        const ratio = val(q.give) / Math.max(1, val(q.get));
        const ok = !givesGroupPiece && (completes || ratio >= (givesCompleter ? 1.35 : 1.1));
        return { type: ok ? 'acceptTrade' : 'declineTrade', playerId: to.id };
      }
      default: return null;
    }
  }
  g.GameAI = { decide };
})(typeof window !== 'undefined' ? window : globalThis);
