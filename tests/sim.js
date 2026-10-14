/* Headless all-AI simulation. Usage: node tests/sim.js [games] [years] [seed] */
const path = require('path');
require(path.join(__dirname, '..', 'js', 'data.js'));
require(path.join(__dirname, '..', 'js', 'engine.js'));
require(path.join(__dirname, '..', 'js', 'ai.js'));
const { Game, fmtMoney } = globalThis.GameEngine;
const { AIController } = globalThis.GameAI;

async function play(seed, years, verbose) {
  const game = new Game({ years, seed, players: [1, 2, 3, 4, 5].map(i => ({ name: 'AI ' + i, isAI: true })) });
  game.players.forEach(p => game.setController(p.id, new AIController(game)));
  let maxLog = 0;
  game.on('log', e => { if (verbose) console.log(game.dateLabel(e.month), '|', e.text); maxLog++; });
  await game.run();
  const rank = game.finalRanking();
  return { game, rank, logs: maxLog };
}
(async () => {
  const games = Number(process.argv[2] || 3), years = Number(process.argv[3] || 15), seed0 = Number(process.argv[4] || 1);
  const verbose = process.argv.includes('-v');
  const bgWins = {}; const bgRank = {};
  for (let i = 0; i < games; i++) {
    const { game, rank } = await play(seed0 + i, years, verbose);
    const bankrupt = game.players.filter(p => p.bankrupt).length, dead = game.players.filter(p => p.dead).length;
    console.log(`seed ${seed0 + i}: ${game.dateLabel()} market ${Math.round(game.eco.marketIndex)} stock ${Math.round(game.eco.stockIndex)} rate ${game.eco.interestRate.toFixed(2)} bankrupt ${bankrupt} dead ${dead} events ${game.news.filter(n => n.kind === 'event').length}`);
    rank.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name.padEnd(6)} ${p.bgTitle.padEnd(22)} start ${fmtMoney(p.startNetWorth, true).padStart(8)} end ${fmtMoney(game.netWorth(p), true).padStart(8)} cash ${fmtMoney(p.cash, true).padStart(7)} props ${game.playerProperties(p).length} debt ${fmtMoney(p.debt, true)} health ${Math.round(p.health)} age ${p.age} taxes ${fmtMoney(p.stats.taxes, true)} medical ${fmtMoney(p.stats.medical, true)}${p.bankrupt ? ' BANKRUPT' : ''}${p.dead ? ' DEAD' : ''}`);
      bgRank[p.bgTitle] = (bgRank[p.bgTitle] || []); bgRank[p.bgTitle].push(i + 1);
    });
    bgWins[rank[0].bgTitle] = (bgWins[rank[0].bgTitle] || 0) + 1;
  }
  console.log('wins by background:', bgWins);
  console.log('avg rank by background:', Object.fromEntries(Object.entries(bgRank).map(([k, v]) => [k, (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)])));
})().catch(e => { console.error(e); process.exit(1); });
