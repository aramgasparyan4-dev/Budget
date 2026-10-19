/* Headless all-AI games. node tests/sim.js [games] [rounds] [seed] [-v] */
const path = require('path');
require(path.join(__dirname, '..', 'js', 'data.js')); require(path.join(__dirname, '..', 'js', 'engine.js')); require(path.join(__dirname, '..', 'js', 'ai.js'));
const { Game, fmt } = globalThis.GameEngine; const { decide } = globalThis.GameAI;
const games = Number(process.argv[2] || 5), rounds = Number(process.argv[3] || 24), seed0 = Number(process.argv[4] || 1), nplayers = Number(process.argv[5] || 5), verbose = process.argv.includes('-v');
const wins = {}, ranks = {};
for (let gi = 0; gi < games; gi++) {
  const game = new Game({ rounds, seed: seed0 + gi, players: Array.from({ length: nplayers }, (_, i) => ({ name: 'P' + (i + 1), isAI: true })) });
  let steps = 0, logged = 0;
  while (!game.state.over && steps < 20000) {
    const q = game.pending; if (!q) throw new Error('no pending');
    const a = decide(game, q); if (!a) throw new Error('no action for ' + JSON.stringify(q));
    const r = game.dispatch(a); if (!r.ok) throw new Error('action failed: ' + JSON.stringify(a) + ' ' + r.msg + ' pending=' + JSON.stringify(q));
    steps++;
    if (verbose) { const l = game.state.log; for (; logged < l.length; logged++) console.log(`R${l[logged].round} | ${l[logged].text}`); }
  }
  if (!game.state.over) throw new Error('did not finish');
  const st = game.state, rank = game.ranking();
  console.log(`seed ${seed0 + gi}: ${st.round - 1} rounds, ${steps} actions, prices ${Math.round(st.priceMult * 100)}%, bankruptcies ${st.players.reduce((n, p) => n + (p.bankruptcies || 0), 0)}, houses ${Object.values(st.props).reduce((s, p) => s + p.houses, 0)}, owned ${Object.values(st.props).filter(p => p.owner !== null).length}/26, groups ${Object.keys(D().GROUPS).filter(gr => gr !== 'transport' && st.players.some(p => game.ownsGroup(p.id, gr))).length}, trades ${st.log.filter(e => /accepts:/.test(e.text)).length}, auctions ${st.log.filter(e => /wins the auction/.test(e.text)).length}`);
  rank.forEach((p, i) => { const bg = D().BACKGROUNDS.find(b => b.id === p.bg); console.log(`   ${i + 1}. ${p.name} ${bg.title.padEnd(20)} start ${fmt(p.startNW, true).padStart(7)} end ${fmt(game.netWorth(p), true).padStart(7)} cash ${fmt(p.cash, true).padStart(6)} props ${game.propsOf(p.id).length} laps ${p.laps} tax ${fmt(p.stats.tax, true)} rentGot ${fmt(p.stats.rentGot, true)} medical ${fmt(p.stats.medical, true)}${p.bankruptcies ? ' BANKRUPT x' + p.bankruptcies : ''}`); ranks[bg.title] = (ranks[bg.title] || []).concat(i + 1); });
  wins[D().BACKGROUNDS.find(b => b.id === rank[0].bg).title] = (wins[D().BACKGROUNDS.find(b => b.id === rank[0].bg).title] || 0) + 1;
}
function D() { return globalThis.GAME_DATA; }
console.log('wins', wins); console.log('avg rank', Object.fromEntries(Object.entries(ranks).map(([k, v]) => [k, (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)])));
