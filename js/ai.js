/* Real Estate Capital v2 — computer players. Given the state and a pending decision, return one action. */
(function (g) {
  'use strict';
  const D = g.GAME_DATA;

  function reserve(game, p) { return 30000 + (p.insured ? 0 : 20000) + 5000 * game.propsOf(p.id).length; }

  function manage(game, p) {
    // returns one management action or null
    const st = game.state;
    if (!p.insured && p.cash > 60000) return { type: 'insurance', playerId: p.id, on: true };
    // pay off mortgages when flush
    for (const i of game.propsOf(p.id)) { const pr = game.prop(i); if (pr.mortgaged && p.cash > game.price(i) * 0.55 + reserve(game, p) * 2) return { type: 'unmortgage', playerId: p.id, square: i }; }
    // build evenly on the cheapest buildable group square
    const buildable = game.propsOf(p.id).filter(i => game.canBuild(p.id, i)).sort((a, b) => game.prop(a).houses - game.prop(b).houses || game.houseCost(a) - game.houseCost(b));
    if (buildable.length) { const i = buildable[0]; if (p.cash - game.houseCost(i) > reserve(game, p)) return { type: 'build', playerId: p.id, square: i }; }
    return null;
  }

  function raise(game, p) {
    // in debt: sell houses, then mortgage, cheapest first
    const withHouses = game.propsOf(p.id).filter(i => game.prop(i).houses > 0).sort((a, b) => game.prop(b).houses - game.prop(a).houses);
    if (withHouses.length) return { type: 'sellHouse', playerId: p.id, square: withHouses[0] };
    const mort = game.propsOf(p.id).filter(i => !game.prop(i).mortgaged).sort((a, b) => game.price(a) - game.price(b));
    if (mort.length) return { type: 'mortgage', playerId: p.id, square: mort[0] };
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
        const sq = game.sq(q.square); const mine = game.groupSquares(sq.group).filter(i => game.prop(i).owner === p.id).length;
        const want = p.cash - q.price > reserve(game, p) * (mine > 0 ? 0.5 : 1);
        return { type: want ? 'buy' : 'pass', playerId: p.id };
      }
      case 'notice': case 'card': return { type: 'ack', playerId: p.id };
      case 'debt': return p.cash >= 0 ? { type: 'payDebt', playerId: p.id } : raise(game, p);
      case 'trade': {
        const val = s => s.cash + s.props.reduce((t, i) => t + game.price(i) * (game.prop(i).mortgaged ? 0.5 : 1), 0);
        const to = game.player(q.toId);
        // accept if what we get is worth at least 10% more than what we give, or it completes a group for us
        const completes = q.give.props.some(i => { const grp = game.sq(i).group; return game.groupSquares(grp).every(j => game.prop(j).owner === to.id || q.give.props.includes(j)); });
        const givesAwayGroupPiece = q.get.props.some(i => { const grp = game.sq(i).group; return game.groupSquares(grp).filter(j => game.prop(j).owner === to.id).length >= 2; });
        const ok = !givesAwayGroupPiece && (completes || val(q.give) >= val(q.get) * 1.1);
        return { type: ok ? 'acceptTrade' : 'declineTrade', playerId: to.id };
      }
      default: return null;
    }
  }
  g.GameAI = { decide };
})(typeof window !== 'undefined' ? window : globalThis);
