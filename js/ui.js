/* Real Estate Capital — browser UI */
(function () {
  'use strict';
  const D = window.GAME_DATA;
  const { Game, fmtMoney, mortgagePayment } = window.GameEngine;
  const { AIController } = window.GameAI;
  const $ = s => document.querySelector(s);
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pct = v => Math.round(v * 100) + '%';
  const SAVE_KEY = 'real-estate-capital-save';

  const ui = { game: null, tab: 'overview', selectedProp: null, waiting: null, aiSpeed: 700, viewPlayer: null, sideTab: 'log', marketFilter: 'all', renderQueued: false, humans: 0 };

  /* ---------------- setup screen ---------------- */
  function setupRow(i, name, isAI) {
    const row = document.createElement('div'); row.className = 'player-row';
    row.innerHTML = `<span class="swatch" style="background:${D.COLORS[i]}"></span><input type="text" value="${esc(name)}" maxlength="16"><select><option value="human"${isAI ? '' : ' selected'}>Human</option><option value="ai"${isAI ? ' selected' : ''}>Computer</option></select><button class="btn tiny danger rm">×</button>`;
    row.querySelector('.rm').onclick = () => { if ($('#playerRows').children.length > 2) { row.remove(); recolorRows(); } };
    return row;
  }
  function recolorRows() { [...$('#playerRows').children].forEach((r, i) => { r.querySelector('.swatch').style.background = D.COLORS[i]; }); }
  function initSetup() {
    const rows = $('#playerRows');
    rows.appendChild(setupRow(0, 'You', false));
    rows.appendChild(setupRow(1, 'Dana (AI)', true));
    rows.appendChild(setupRow(2, 'Marcus (AI)', true));
    rows.appendChild(setupRow(3, 'Priya (AI)', true));
    $('#addPlayer').onclick = () => { if (rows.children.length < 6) { rows.appendChild(setupRow(rows.children.length, `Player ${rows.children.length + 1}`, true)); } };
    $('#startBtn').onclick = () => {
      const players = [...rows.children].map(r => ({ name: r.querySelector('input').value.trim() || 'Player', isAI: r.querySelector('select').value === 'ai' }));
      ui.aiSpeed = Number($('#aiSpeed').value);
      const seed = $('#seed').value.trim();
      startGame(new Game({ players, years: Number($('#years').value), equalStart: $('#equalStart').checked, seed: seed === '' ? null : (/^\d+$/.test(seed) ? Number(seed) : hashStr(seed)) }));
    };
    let saved = null;
    try { saved = localStorage.getItem(SAVE_KEY); } catch (e) { /* ignore */ }
    if (saved) { $('#continueBtn').classList.remove('hidden'); $('#continueBtn').onclick = () => { try { ui.aiSpeed = Number($('#aiSpeed').value); startGame(Game.fromJSON(JSON.parse(saved))); } catch (e) { console.error(e); toast('Saved game could not be loaded', 'bad'); } }; }
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---------------- controllers ---------------- */
  class HumanController {
    constructor(game) { this.game = game; }
    async preRoll(p) {
      if (ui.humans > 1) await showModal({ playerName: p.name, title: `${p.name}'s turn`, text: `${p.bgTitle}. Pass the device to ${p.name}.`, options: [{ id: 'ok', label: 'Ready' }] });
      ui.viewPlayer = p.id;
      await waitFor('roll');
    }
    async postRoll(p) { ui.viewPlayer = p.id; await waitFor('end'); }
    async decide(p, spec) { return showModal(Object.assign({ playerName: p.name }, spec)); }
    async skipped(p) { await showModal({ playerName: p.name, title: 'Turn skipped', text: `${p.name} is ${p.skipReason} this month.`, options: [{ id: 'ok', label: 'OK' }] }); }
  }
  function waitFor(kind) { return new Promise(resolve => { ui.waiting = { kind, resolve }; render(); }); }
  function resolveWaiting(kind) { if (ui.waiting && ui.waiting.kind === kind) { const r = ui.waiting.resolve; ui.waiting = null; r(); render(); } }

  /* ---------------- modal ---------------- */
  let modalChain = Promise.resolve();
  function showModal(spec) {
    const run = () => new Promise(resolve => {
      const box = $('#modalBox'); $('#modal').classList.remove('hidden');
      let html = '';
      if (spec.playerName) html += `<div class="for">${esc(spec.playerName)}</div>`;
      html += `<h2>${esc(spec.title || '')}</h2>`;
      if (spec.text) html += `<div class="text">${esc(spec.text)}</div>`;
      if (spec.html) html += spec.html;
      if (spec.amount) html += `<div class="amt"><input type="number" id="amtInput" min="${spec.amount.min || 0}" max="${spec.amount.max}" step="100" value="${Math.round(spec.amount.value || spec.amount.max)}"> <span class="muted">max ${fmtMoney(spec.amount.max)}</span> <button class="btn tiny" id="amtMax">Max</button></div>`;
      html += '<div class="opts">' + (spec.options || []).map(o => `<button class="opt" data-id="${esc(o.id)}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}${o.desc ? `<span class="desc">${esc(o.desc)}</span>` : ''}</button>`).join('') + '</div>';
      box.innerHTML = html;
      if (spec.amount) $('#amtMax').onclick = () => { $('#amtInput').value = Math.round(spec.amount.max); };
      box.querySelectorAll('.opt').forEach(b => { b.onclick = () => { $('#modal').classList.add('hidden'); resolve(spec.amount ? { id: b.dataset.id, amount: Number($('#amtInput').value) } : b.dataset.id); }; });
      const first = box.querySelector('.opt:not(:disabled)'); if (first) first.focus();
    });
    const p = modalChain.then(run, run);
    modalChain = p.catch(() => {});
    return p;
  }
  async function askAmount(title, text, max, value, min) {
    if (max <= 0) { toast('Nothing available', 'bad'); return null; }
    const r = await showModal({ title, text, amount: { max, value: value === undefined ? max : value, min: min || 0 }, options: [{ id: 'ok', label: 'Confirm' }, { id: 'cancel', label: 'Cancel' }] });
    if (r.id !== 'ok' || !(r.amount > 0)) return null;
    return Math.min(r.amount, max);
  }
  function toast(msg, kind) {
    const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4000);
  }

  /* ---------------- game start ---------------- */
  function startGame(game) {
    ui.game = game; ui.tab = 'overview'; ui.selectedProp = null; ui.waiting = null; ui.viewPlayer = null;
    ui.humans = game.players.filter(p => !p.isAI).length;
    game.players.forEach(p => {
      if (p.isAI) game.setController(p.id, new AIController(game, { delay: () => sleep(ui.aiSpeed), onDecision: (pl, spec, r) => { const o = spec.options.find(x => x.id === r); if (o && spec.type === 'buy' && r !== 'pass') toast(`${pl.name}: ${o.label}`); } }));
      else game.setController(p.id, new HumanController(game));
    });
    game.on('change', render);
    game.on('log', () => { if (ui.sideTab === 'log') renderSide(); });
    game.on('news', n => { toast(n.headline, n.kind === 'event' ? 'bad' : ''); if (ui.sideTab === 'news') renderSide(); });
    game.on('openTab', t => { ui.tab = t; render(); });
    game.on('medical', ({ player, kind, oop }) => toast(`${player.name}: ${kind.name}, pays ${fmtMoney(oop)}`, 'bad'));
    game.on('turnStart', p => { if (!p.isAI) save(); });
    game.on('turnEnd', () => { ui.waiting = null; });
    game.on('gameover', showGameOver);
    game.hooks.yearEnd = showYearReport;
    const firstHuman = game.players.find(p => !p.isAI);
    ui.viewPlayer = firstHuman ? firstHuman.id : 0;
    $('#setup').classList.add('hidden'); $('#game').classList.remove('hidden');
    buildBoard(); render(); renderSide();
    if (!game.over) game.run().catch(e => { console.error(e); toast('Engine error: ' + e.message, 'bad'); });
    else showGameOver(game.finalRanking());
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(ui.game.toJSON())); } catch (e) { /* ignore */ } }

  /* ---------------- board ---------------- */
  function cellPos(i) {
    if (i <= 10) return [11, 11 - i];
    if (i <= 20) return [11 - (i - 10), 1];
    if (i <= 30) return [1, 1 + (i - 20)];
    return [1 + (i - 30), 11];
  }
  function buildBoard() {
    const board = $('#board'); board.innerHTML = '';
    D.BOARD.forEach((sp, i) => {
      const c = document.createElement('div'); c.className = 'cell' + (sp.kind === 'property' ? '' : ' special'); c.dataset.i = i;
      const [r, col] = cellPos(i); c.style.gridRow = r; c.style.gridColumn = col;
      c.onclick = () => { if (sp.kind === 'property') { ui.selectedProp = i; ui.tab = 'properties'; render(); } };
      board.appendChild(c);
    });
    const center = document.createElement('div'); center.className = 'center'; center.id = 'center'; board.appendChild(center);
  }
  function updateBoard() {
    const g = ui.game;
    document.querySelectorAll('.cell').forEach(c => {
      const i = Number(c.dataset.i), sp = D.BOARD[i];
      const toks = g.players.filter(p => g.isActive(p) && p.position === i).map(p => `<span class="tok" style="background:${p.color}" title="${esc(p.name)}">${esc(p.name[0])}</span>`).join('');
      c.classList.toggle('active', !!(g.current && g.current.position === i));
      if (sp.kind !== 'property') { c.innerHTML = `<div class="icon">${sp.icon}</div><div class="name">${esc(sp.name)}</div><div class="tokens">${toks}</div>`; return; }
      const pr = g.prop(i); const d = D.DISTRICTS[pr.district];
      const owner = pr.owner === null ? null : g.players[pr.owner];
      c.style.background = owner ? `linear-gradient(0deg, ${owner.color}33, var(--panel) 60%)` : '';
      c.innerHTML = `<div class="stripe" style="background:${d.color}"></div>${pr.listedPrice !== null ? '<span class="flag">SALE</span>' : ''}${g.ownsDistrict(pr.owner, pr.district) ? '<span class="mono" title="Whole district owned">★</span>' : ''}<div class="body"><div class="name">${esc(pr.name)}</div><div class="price">${fmtMoney(g.propertyValue(pr), true)}</div>${owner ? `<div class="owner" style="color:${owner.color}">${esc(owner.name)}</div>` : '<div class="owner muted">for sale</div>'}<div class="tokens">${toks}</div></div><div class="cond" style="width:${Math.round(pr.condition)}%;background:${pr.condition < 45 ? 'var(--bad)' : pr.condition < 70 ? 'var(--warn)' : 'var(--good)'}"></div>`;
    });
  }

  /* ---------------- rendering ---------------- */
  function render() {
    if (ui.renderQueued) return; ui.renderQueued = true;
    requestAnimationFrame(() => { ui.renderQueued = false; if (!ui.game) return; try { renderTop(); updateBoard(); renderCenter(); renderPlayers(); } catch (e) { console.error(e); } });
  }
  function renderTop() {
    const g = ui.game, e = g.eco;
    const cyc = { expansion: 'Expansion', peak: 'Peak', recession: 'Recession', recovery: 'Recovery' }[e.cycle];
    const h = e.history; const prev = h.length > 12 ? h[h.length - 13].market : 100;
    const yoy = (e.marketIndex / prev - 1) * 100;
    $('#topbar').innerHTML = `<span class="stat"><b>${esc(g.dateLabel())}</b> · year ${Math.floor(g.month / 12) + 1} of ${g.cfg.years}</span>
      <span class="stat">Economy <b class="${e.cycle === 'recession' ? 'bad' : e.cycle === 'peak' ? 'warn' : 'good'}">${cyc}</b></span>
      <span class="stat">Property index <b>${Math.round(e.marketIndex)}</b> <span class="${yoy >= 0 ? 'good' : 'bad'}">${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}% y/y</span></span>
      <span class="stat">Stocks <b>${Math.round(e.stockIndex)}</b></span>
      <span class="stat">Rates <b>${e.interestRate.toFixed(2)}%</b></span>
      <span class="stat">Inflation <b>${e.inflation.toFixed(1)}%</b></span>
      ${g.activeEvents.map(ev => `<span class="chip event" title="${esc(ev.desc)}">${esc(ev.name)} · ${ev.monthsLeft}m</span>`).join('')}`;
  }
  function viewP() { const g = ui.game; return g.players[ui.viewPlayer === null ? 0 : ui.viewPlayer] || g.players[0]; }
  function actingHuman() { const g = ui.game; return ui.waiting && g.current && !g.current.isAI ? g.current : null; }
  function canAct(p) { const a = actingHuman(); return !!a && a.id === p.id; }

  function renderCenter() {
    const g = ui.game; const cur = g.current; const p = viewP();
    const act = actingHuman();
    let status;
    if (g.over) status = 'Game over.';
    else if (act) status = ui.waiting.kind === 'roll' ? 'Your turn. Manage your affairs, then roll.' : 'Buy, sell, borrow, invest. Then end your turn.';
    else if (cur) status = cur.isAI ? `${cur.name} is playing...` : `${cur.name} is deciding...`;
    else status = 'Processing month end...';
    const dice = g.lastRoll ? ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][g.lastRoll[0] - 1] + ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][g.lastRoll[1] - 1] : '';
    const tabs = [['overview', 'Overview'], ['properties', 'Properties'], ['market', 'Market'], ['bank', 'Bank'], ['stocks', 'Stocks'], ['news', 'News']];
    $('#center').innerHTML = `<div class="center-head">
        <div class="who">${cur ? `<span class="dot" style="background:${cur.color}"></span>${esc(cur.name)}<span class="muted" style="font-weight:400">· ${esc(cur.bgTitle)}</span>` : '<span class="muted">Month end</span>'}</div>
        <span class="dice">${dice}</span><span class="status">${esc(status)}</span>
        ${act && ui.waiting.kind === 'roll' ? '<button class="btn primary" id="rollBtn">Roll dice</button>' : ''}
        ${act && ui.waiting.kind === 'end' ? '<button class="btn primary" id="endBtn">End turn</button>' : ''}
      </div>
      <div class="tabs">${tabs.map(([id, l]) => `<button data-tab="${id}" class="${ui.tab === id ? 'active' : ''}">${l}</button>`).join('')}<span style="flex:1"></span><span class="muted" style="padding:6px 4px;font-size:12px">Viewing: <b style="color:${p.color}">${esc(p.name)}</b>${canAct(p) ? '' : ' (read-only)'}</span></div>
      <div class="tab-body" id="tabBody"></div>`;
    const rb = $('#rollBtn'); if (rb) rb.onclick = () => resolveWaiting('roll');
    const eb = $('#endBtn'); if (eb) eb.onclick = () => resolveWaiting('end');
    $('#center').querySelectorAll('.tabs button').forEach(b => { b.onclick = () => { ui.tab = b.dataset.tab; render(); }; });
    const body = $('#tabBody');
    ({ overview: renderOverview, properties: renderProperties, market: renderMarket, bank: renderBank, stocks: renderStocks, news: renderNews })[ui.tab](body, p);
  }

  function act(fn) { const r = fn(); if (r && r.msg) toast(r.msg, r.ok ? 'good' : 'bad'); render(); }
  function btn(label, onclick, opts) { const b = document.createElement('button'); b.className = 'btn tiny ' + ((opts && opts.cls) || ''); b.textContent = label; b.disabled = !!(opts && opts.disabled); b.title = (opts && opts.title) || ''; b.onclick = onclick; return b; }

  function renderOverview(body, p) {
    const g = ui.game; const me = canAct(p);
    const inc = g.monthlyIncome(p), obl = g.monthlyObligations(p);
    const hp = g.healthPremium(p);
    body.innerHTML = `<div class="grid2">
      <div class="box"><h3>Profile</h3><div class="kv">
        <span class="k">Background</span><span class="v">${esc(p.bgTitle)}</span>
        <span class="k">Job</span><span class="v">${esc(p.job)}${p.laidOff > 0 ? ` <span class="bad">(laid off, ${p.laidOff} mo)</span>` : ''}${p.retired ? '' : ''}</span>
        <span class="k">Age</span><span class="v">${p.age}</span>
        <span class="k">Health</span><span class="v ${p.health < 40 ? 'bad' : p.health < 65 ? 'warn' : 'good'}">${Math.round(p.health)}/100</span>
        <span class="k">Children</span><span class="v">${p.children}</span>
        <span class="k">Health insurance</span><span class="v">${p.healthInsurance ? `<span class="good">Yes</span> · ${fmtMoney(hp)}/mo` : `<span class="bad">None</span> · ${fmtMoney(hp)}/mo to enroll`}</span>
        <span class="k">Credit score</span><span class="v">${Math.round(p.creditScore)}</span>
        <span class="k">Status</span><span class="v">${p.skipTurns > 0 ? `<span class="warn">${esc(p.skipReason)} (${p.skipTurns} turn${p.skipTurns > 1 ? 's' : ''})</span>` : p.inDefault ? '<span class="bad">IN DEFAULT: raise cash now</span>' : 'OK'}</span>
      </div><div class="bar" style="margin-top:8px"><div style="width:${p.health}%;background:${p.health < 40 ? 'var(--bad)' : p.health < 65 ? 'var(--warn)' : 'var(--good)'}"></div></div>
      <div id="ovActions" style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap"></div></div>
      <div class="box"><h3>Finances</h3><div class="kv">
        <span class="k">Cash</span><span class="v ${p.cash < 0 ? 'bad' : ''}">${fmtMoney(p.cash)}</span>
        <span class="k">Net worth</span><span class="v"><b>${fmtMoney(g.netWorth(p))}</b> <span class="muted">(started ${fmtMoney(p.startNetWorth, true)})</span></span>
        <span class="k">Salary</span><span class="v">${fmtMoney(p.salary)}/mo${p.sideIncome ? ` + ${fmtMoney(p.sideIncome)} side` : ''}</span>
        <span class="k">Living costs</span><span class="v">${fmtMoney(p.living + p.children * 700)}/mo</span>
        <span class="k">Properties</span><span class="v">${g.playerProperties(p).length} · equity ${fmtMoney(g.playerProperties(p).reduce((s, pr) => s + g.equity(pr), 0), true)}</span>
        <span class="k">Stocks</span><span class="v">${fmtMoney(g.stocksValue(p))}</span>
        <span class="k">Credit line debt</span><span class="v ${p.debt > 0 ? 'bad' : ''}">${fmtMoney(p.debt)} <span class="muted">of ${fmtMoney(g.creditLimit(p), true)} limit @ ${g.creditRate().toFixed(1)}%</span></span>
        <span class="k">Loans</span><span class="v">${fmtMoney(g.loanBalance(p))}</span>
        <span class="k">Est. monthly income</span><span class="v good">${fmtMoney(inc)}</span>
        <span class="k">Est. monthly obligations</span><span class="v bad">${fmtMoney(obl)}</span>
        <span class="k">Est. monthly net</span><span class="v ${inc - obl >= 0 ? 'good' : 'bad'}"><b>${fmtMoney(inc - obl)}</b></span>
      </div></div>
      <div class="box"><h3>Lifetime</h3><div class="kv">
        <span class="k">Taxes paid</span><span class="v">${fmtMoney(p.stats.taxes)}</span>
        <span class="k">Medical bills paid</span><span class="v">${fmtMoney(p.stats.medical)}</span>
        <span class="k">Rent collected</span><span class="v">${fmtMoney(p.stats.rentCollected)}</span>
        <span class="k">Rent paid to others</span><span class="v">${fmtMoney(p.stats.rentPaid)}</span>
        <span class="k">Interest paid</span><span class="v">${fmtMoney(p.stats.interestPaid)}</span>
        <span class="k">This year's income so far</span><span class="v">${fmtMoney(p.year.salary + p.year.rent + p.year.dividends)}</span>
      </div></div>
      <div class="box"><h3>Tax rules</h3><div class="muted" style="font-size:12px">Income tax (December): 10% to $20k, 20% to $80k, 32% to $200k, 40% above, after a $14k standard deduction. Rental expenses and mortgage interest are deductible. Property tax 1.1%/yr. Capital gains 20% on sale profits. Current tax multiplier: <b>${g.taxMult().toFixed(2)}×</b>.</div></div>
    </div>`;
    if (me) {
      const a = $('#ovActions');
      a.appendChild(btn(p.healthInsurance ? 'Drop health insurance' : `Enroll in health insurance (${fmtMoney(hp)}/mo)`, () => act(() => g.setHealthInsurance(p, !p.healthInsurance))));
      if (p.debt > 0) a.appendChild(btn('Pay down credit line', async () => { const amt = await askAmount('Pay credit line', `Debt ${fmtMoney(p.debt)} at ${g.creditRate().toFixed(1)}%.`, Math.min(p.debt, Math.max(0, p.cash))); if (amt) act(() => g.payDebt(p, amt)); }, { disabled: p.cash <= 0 }));
    }
  }

  function propCard(pr, p, me) {
    const g = ui.game; const d = D.DISTRICTS[pr.district];
    const value = g.propertyValue(pr), rent = g.monthlyRentCollected(pr), costs = g.monthlyPropertyCosts(pr), net = rent - costs.total;
    const card = document.createElement('div'); card.className = 'prop'; card.style.borderLeftColor = d.color;
    card.innerHTML = `<div class="head"><b>${esc(pr.name)}</b><span class="muted">${esc(d.name)} · ${pr.type}${g.ownsDistrict(pr.owner, pr.district) ? ' · ★ whole district (+25% rent)' : ''}</span></div>
      <div class="meta"><span>Value <b>${fmtMoney(value)}</b></span><span>Paid ${fmtMoney(pr.costBasis, true)}</span><span>Rent <b class="good">${fmtMoney(rent)}</b>/mo (gross ${fmtMoney(g.grossRent(pr))}, occupancy ${pct(pr.occupancy)})</span><span>Costs <b class="bad">${fmtMoney(costs.total)}</b>/mo (tax ${fmtMoney(costs.tax)}, upkeep ${fmtMoney(costs.maint)}${costs.ins ? `, insurance ${fmtMoney(costs.ins)}` : ''}${costs.mort ? `, mortgage ${fmtMoney(costs.mort)}` : ''})</span><span>Net <b class="${net >= 0 ? 'good' : 'bad'}">${fmtMoney(net)}</b>/mo</span></div>
      <div class="meta"><span>Condition <b class="${pr.condition < 45 ? 'bad' : pr.condition < 70 ? 'warn' : 'good'}">${Math.round(pr.condition)}</b>/100</span><span>Renovation ${pr.renovation}/3</span><span>${pr.insured ? '<span class="good">Insured</span>' : '<span class="warn">Uninsured</span>'}</span><span>Rent policy: ${pr.strategy}</span>${pr.mortgage ? `<span>Mortgage <b>${fmtMoney(pr.mortgage.balance)}</b> @ ${pr.mortgage.rate}% (${fmtMoney(pr.mortgage.payment)}/mo, ${Math.ceil(pr.mortgage.monthsLeft / 12)} yrs left)</span>` : '<span>No mortgage</span>'}${pr.listedPrice !== null ? `<span class="warn">Listed at ${fmtMoney(pr.listedPrice)}</span>` : ''}<span>Landing fee for visitors: ${fmtMoney(g.landingFee(pr))}</span></div>`;
    if (me) {
      const a = document.createElement('div'); a.className = 'actions';
      const rc = g.repairCost(pr);
      a.appendChild(btn(`Repair (${fmtMoney(rc)})`, () => act(() => g.repair(p, pr.id)), { disabled: rc <= 0 || p.cash < rc, title: 'Restore condition to 100' }));
      const rn = g.renovateCost(pr);
      a.appendChild(btn(`Renovate (${fmtMoney(rn)})`, () => act(() => g.renovate(p, pr.id)), { disabled: pr.renovation >= 3 || p.cash < rn, title: '+10% value, +12% rent, +15 condition' }));
      a.appendChild(btn(pr.insured ? 'Cancel insurance' : `Insure (${fmtMoney(value * D.COSTS.propertyInsuranceRate / 12 * g.insuranceMult())}/mo)`, () => act(() => g.setInsured(p, pr.id, !pr.insured)), { title: 'Covers disaster damage and half of lawsuit costs' }));
      const seg = document.createElement('span'); seg.className = 'seg';
      [['low', 'Low rent'], ['market', 'Market'], ['high', 'High rent']].forEach(([s, l]) => { const b = document.createElement('button'); b.textContent = l; b.className = pr.strategy === s ? 'on' : ''; b.title = s === 'low' ? '-15% rent, +7% occupancy' : s === 'high' ? '+20% rent, -15% occupancy' : 'Market rent'; b.onclick = () => act(() => g.setStrategy(p, pr.id, s)); seg.appendChild(b); });
      a.appendChild(seg);
      const maxLoan = Math.round(value * 0.8), cur = pr.mortgage ? pr.mortgage.balance : 0;
      a.appendChild(btn(pr.mortgage ? 'Cash-out refinance' : 'Take mortgage', async () => { const amt = await askAmount(pr.mortgage ? 'Cash-out refinance' : 'Mortgage', `Up to 80% of value (${fmtMoney(maxLoan)}) at ${g.mortgageRate(p).toFixed(2)}%, 30 years. 1.5% closing cost.${cur ? ` Replaces the current ${fmtMoney(cur)} balance.` : ''}`, maxLoan, maxLoan, cur + 1000); if (amt) act(() => g.takeMortgage(p, pr.id, amt)); }, { disabled: maxLoan <= cur + 5000 || p.creditScore < 580 }));
      if (pr.mortgage) {
        a.appendChild(btn('Refinance rate', () => act(() => g.refinance(p, pr.id)), { disabled: g.mortgageRate(p) >= pr.mortgage.rate, title: `New rate ${g.mortgageRate(p).toFixed(2)}% vs ${pr.mortgage.rate}%` }));
        a.appendChild(btn('Pay down mortgage', async () => { const amt = await askAmount('Pay down mortgage', `Balance ${fmtMoney(pr.mortgage.balance)} at ${pr.mortgage.rate}%.`, Math.min(pr.mortgage.balance, Math.max(0, p.cash))); if (amt) act(() => g.payMortgage(p, pr.id, amt)); }, { disabled: p.cash <= 0 }));
      }
      if (pr.listedPrice === null) a.appendChild(btn('List for sale', async () => { const amt = await askAmount('List for sale', `Market value ${fmtMoney(value)}. Other players can buy at your price on their turn. 5% agent fee on sale.`, Math.round(value * 1.5), Math.round(value * 1.05), 1000); if (amt) act(() => g.listProperty(p, pr.id, amt)); }));
      else a.appendChild(btn('Remove listing', () => act(() => g.unlistProperty(p, pr.id))));
      const qs = Math.round(value * D.COSTS.quickSaleFactor);
      a.appendChild(btn(`Quick sale (${fmtMoney(qs)})`, async () => { const r = await showModal({ title: 'Quick sale', text: `Sell ${pr.name} to a cash buyer now for ${fmtMoney(qs)} (80% of value), minus 2% fees${pr.mortgage ? ` and the ${fmtMoney(pr.mortgage.balance)} mortgage` : ''}, minus capital gains tax on any profit.`, options: [{ id: 'yes', label: 'Sell now' }, { id: 'no', label: 'Cancel' }] }); if (r === 'yes') act(() => g.quickSale(p, pr.id)); }, { cls: 'danger' }));
      card.appendChild(a);
    }
    return card;
  }
  function renderProperties(body, p) {
    const g = ui.game; const me = canAct(p);
    body.innerHTML = '';
    if (ui.selectedProp !== null) {
      const pr = g.prop(ui.selectedProp);
      if (pr) {
        const h = document.createElement('div'); h.className = 'box';
        const owner = pr.owner === null ? null : g.players[pr.owner];
        h.innerHTML = `<h3>Selected property</h3><div class="muted" style="font-size:12px;margin-bottom:6px">${esc(D.DISTRICTS[pr.district].desc)} Owner: <b style="color:${owner ? owner.color : 'inherit'}">${owner ? esc(owner.name) : 'nobody (bank)'}</b>.</div>`;
        h.appendChild(propCard(pr, owner || p, !!owner && owner.id === p.id && me));
        if (!owner && me) {
          const price = Math.round(g.marketPrice(pr) * (1 + D.COSTS.offMarketPremium)), closing = p.freeTrade ? 0 : Math.round(price * D.COSTS.closingCost);
          const a = document.createElement('div'); a.className = 'actions';
          a.appendChild(btn(`Buy off-market, cash (${fmtMoney(price + closing)})`, () => act(() => g.buyProperty(p, pr.id, 0)), { disabled: p.cash < price + closing }));
          a.appendChild(btn(`Buy off-market, 80% mortgage (${fmtMoney(price * 0.2 + closing)} down)`, () => act(() => g.buyProperty(p, pr.id, 0.8)), { disabled: p.cash < price * 0.2 + closing || p.creditScore < 580 }));
          h.appendChild(a);
        } else if (owner && owner.id !== p.id && me) {
          const a = document.createElement('div'); a.className = 'actions';
          a.appendChild(btn('Make an offer', () => offerFlow(p, pr)));
          if (pr.listedPrice !== null) a.appendChild(btn(`Buy at list price (${fmtMoney(pr.listedPrice)})`, () => buyListedFlow(p, pr)));
          h.appendChild(a);
        }
        const close = btn('Close', () => { ui.selectedProp = null; render(); }); close.style.marginTop = '6px'; h.appendChild(close);
        body.appendChild(h);
      }
    }
    const mine = g.playerProperties(p);
    const head = document.createElement('div'); head.className = 'box';
    const totalEq = mine.reduce((s, pr) => s + g.equity(pr), 0), totalNet = mine.reduce((s, pr) => s + g.netMonthlyCashflow(pr), 0);
    head.innerHTML = `<h3>${esc(p.name)}'s portfolio</h3><div class="muted" style="font-size:12px">${mine.length} propert${mine.length === 1 ? 'y' : 'ies'} · equity ${fmtMoney(totalEq)} · net cash flow <b class="${totalNet >= 0 ? 'good' : 'bad'}">${fmtMoney(totalNet)}/mo</b>. Buildings lose condition every month; below 70 occupancy drops, below 45 you risk fines.</div>`;
    body.appendChild(head);
    if (!mine.length) { const e = document.createElement('div'); e.className = 'muted'; e.textContent = 'No properties yet. Land on an unowned building or browse the Market tab.'; body.appendChild(e); }
    mine.forEach(pr => body.appendChild(propCard(pr, p, me)));
  }

  async function offerFlow(p, pr) {
    const g = ui.game; const value = g.propertyValue(pr);
    const r = await showModal({ title: `Offer for ${pr.name}`, text: `Market value ${fmtMoney(value)}. Owner: ${g.players[pr.owner].name}. Choose financing, then your price. Closing cost 2%.`, amount: { max: Math.round(value * 2), value: Math.round(value * 1.05), min: 1000 },
      options: [{ id: 'cash', label: 'Offer, pay cash' }, { id: 'mortgage', label: 'Offer, 80% mortgage', disabled: p.creditScore < 580 }, { id: 'cancel', label: 'Cancel' }] });
    if (r.id === 'cancel' || !(r.amount > 0)) return;
    const res = await g.makeOffer(p, pr.id, r.amount, r.id === 'mortgage' ? 0.8 : 0);
    toast(res.msg, res.ok ? 'good' : 'bad'); render();
  }
  async function buyListedFlow(p, pr) {
    const g = ui.game; const price = pr.listedPrice, closing = p.freeTrade ? 0 : Math.round(price * D.COSTS.closingCost);
    const r = await showModal({ title: `Buy ${pr.name}`, text: `Listed by ${g.players[pr.owner].name} at ${fmtMoney(price)} (market value ${fmtMoney(g.propertyValue(pr))}). Closing ${fmtMoney(closing)}.`,
      options: [{ id: 'cash', label: `Pay cash (${fmtMoney(price + closing)})`, disabled: p.cash < price + closing }, { id: 'mortgage', label: `80% mortgage (${fmtMoney(price - Math.round(Math.min(price, g.propertyValue(pr)) * 0.8) + closing)} down)`, disabled: p.creditScore < 580 || p.cash < price - Math.round(Math.min(price, g.propertyValue(pr)) * 0.8) + closing }, { id: 'cancel', label: 'Cancel' }] });
    if (r === 'cancel') return;
    act(() => g.buyListed(p, pr.id, r === 'mortgage' ? 0.8 : 0));
  }

  function renderMarket(body, p) {
    const g = ui.game; const me = canAct(p);
    const f = ui.marketFilter;
    let list = g.properties.slice();
    if (f === 'sale') list = list.filter(pr => pr.owner === null || pr.listedPrice !== null);
    if (f === 'unowned') list = list.filter(pr => pr.owner === null);
    if (f === 'mine') list = list.filter(pr => pr.owner === p.id);
    if (f === 'others') list = list.filter(pr => pr.owner !== null && pr.owner !== p.id);
    body.innerHTML = `<div class="muted" style="font-size:12px;margin-bottom:6px">One market, live prices. Unowned buildings sell at value + 5% off-market premium (no premium if you land on them). Listed buildings sell at the owner's price. You can also make an offer on anything${p.freeTrade ? ' — <b class="good">closing costs waived this turn</b>' : ''}.</div>
      <div class="filters">${[['all', 'All'], ['sale', 'For sale'], ['unowned', 'Unowned'], ['others', 'Owned by others'], ['mine', 'Mine']].map(([id, l]) => `<button class="btn tiny ${f === id ? 'primary' : ''}" data-f="${id}">${l}</button>`).join('')}</div>
      <table class="t"><thead><tr><th>Property</th><th>District</th><th class="r">Value</th><th class="r">Rent/mo</th><th class="r">Cond.</th><th>Owner</th><th class="r">Status</th><th></th></tr></thead><tbody id="mkt"></tbody></table>`;
    body.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => { ui.marketFilter = b.dataset.f; render(); }; });
    const tb = $('#mkt');
    list.forEach(pr => {
      const d = D.DISTRICTS[pr.district]; const owner = pr.owner === null ? null : g.players[pr.owner];
      const tr = document.createElement('tr'); if (owner && owner.id === p.id) tr.className = 'me';
      const rent = owner ? g.monthlyRentCollected(pr) : Math.round(g.grossRent(Object.assign({}, pr, { owner: -1 })) * g.targetOccupancy(pr));
      tr.innerHTML = `<td><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${d.color};margin-right:6px"></span><a href="#" data-sel="${pr.id}" style="color:inherit">${esc(pr.name)}</a></td><td class="muted">${esc(d.name)}</td><td class="r">${fmtMoney(g.propertyValue(pr), true)}</td><td class="r">${fmtMoney(rent, true)}</td><td class="r ${pr.condition < 45 ? 'bad' : pr.condition < 70 ? 'warn' : ''}">${Math.round(pr.condition)}</td><td style="color:${owner ? owner.color : 'var(--muted)'}">${owner ? esc(owner.name) : 'Bank'}</td><td class="r">${pr.listedPrice !== null ? `<span class="warn">Listed ${fmtMoney(pr.listedPrice, true)}</span>` : owner ? '' : `<span class="muted">Ask ${fmtMoney(g.marketPrice(pr) * 1.05, true)}</span>`}</td><td></td>`;
      tr.querySelector('[data-sel]').onclick = ev => { ev.preventDefault(); ui.selectedProp = pr.id; ui.tab = 'properties'; render(); };
      const cell = tr.lastElementChild;
      if (me) {
        if (!owner) {
          const price = Math.round(g.marketPrice(pr) * 1.05), closing = p.freeTrade ? 0 : Math.round(price * D.COSTS.closingCost);
          cell.appendChild(btn('Buy cash', () => act(() => g.buyProperty(p, pr.id, 0)), { disabled: p.cash < price + closing, title: fmtMoney(price + closing) }));
          cell.appendChild(btn('Buy 80% mtg', () => act(() => g.buyProperty(p, pr.id, 0.8)), { disabled: p.creditScore < 580 || p.cash < price * 0.2 + closing, title: `${fmtMoney(price * 0.2 + closing)} down` }));
        } else if (owner.id !== p.id) {
          if (pr.listedPrice !== null) cell.appendChild(btn('Buy listed', () => buyListedFlow(p, pr)));
          cell.appendChild(btn('Offer', () => offerFlow(p, pr)));
        } else {
          cell.appendChild(btn('Manage', () => { ui.selectedProp = pr.id; ui.tab = 'properties'; render(); }));
        }
      }
      tb.appendChild(tr);
    });
  }

  function renderBank(body, p) {
    const g = ui.game; const me = canAct(p);
    const cap = g.loanCapacity(p);
    body.innerHTML = `<div class="grid2">
      <div class="box"><h3>Rates</h3><div class="kv">
        <span class="k">Central bank rate</span><span class="v">${g.eco.interestRate.toFixed(2)}%</span>
        <span class="k">Your mortgage rate</span><span class="v">${g.mortgageRate(p).toFixed(2)}%${p.bankPromo ? ' <span class="good">(bank promo -0.5%)</span>' : ''}</span>
        <span class="k">Personal loan rate</span><span class="v">${g.loanRate(p).toFixed(2)}%</span>
        <span class="k">Credit line rate</span><span class="v bad">${g.creditRate().toFixed(2)}%</span>
        <span class="k">Credit score</span><span class="v">${Math.round(p.creditScore)} <span class="muted">${p.creditScore < 580 ? '(no mortgages below 580)' : ''}</span></span>
      </div></div>
      <div class="box"><h3>Credit line</h3><div class="kv">
        <span class="k">Balance</span><span class="v ${p.debt > 0 ? 'bad' : ''}">${fmtMoney(p.debt)}</span>
        <span class="k">Limit</span><span class="v">${fmtMoney(g.creditLimit(p))}</span>
        <span class="k">Monthly interest</span><span class="v">${fmtMoney(p.debt * g.creditRate() / 100 / 12)}</span>
      </div><div class="muted" style="font-size:12px;margin-top:6px">Used automatically when your cash goes negative. If the limit is exhausted, stocks and then properties are seized at the end of your next turn.</div><div id="bankDebt" style="margin-top:6px"></div></div>
      <div class="box"><h3>Personal loans</h3><div id="bankLoans"></div><div class="muted" style="font-size:12px;margin-top:6px">Capacity: ${fmtMoney(cap)} (one year of salary, adjusted for credit score, minus existing loans). 5-year term.</div><div id="bankLoanBtn" style="margin-top:6px"></div></div>
      <div class="box"><h3>Mortgages</h3><div id="bankMort"></div></div>
    </div>`;
    const loans = $('#bankLoans');
    if (!p.loans.length) loans.innerHTML = '<span class="muted">None</span>';
    p.loans.forEach((l, i) => { const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px'; row.innerHTML = `<span>${esc(l.name)}: <b>${fmtMoney(l.balance)}</b> @ ${l.rate}% · ${fmtMoney(l.payment)}/mo · ${l.monthsLeft} mo left</span>`; if (me) row.appendChild(btn('Repay', async () => { const amt = await askAmount('Repay loan', `${l.name}: ${fmtMoney(l.balance)} at ${l.rate}%.`, Math.min(l.balance, Math.max(0, p.cash))); if (amt) act(() => g.repayLoan(p, i, amt)); }, { disabled: p.cash <= 0 })); loans.appendChild(row); });
    if (me) {
      $('#bankLoanBtn').appendChild(btn('Take personal loan', async () => { const amt = await askAmount('Personal loan', `Borrow up to ${fmtMoney(cap)} at ${g.loanRate(p).toFixed(2)}% over 5 years.`, cap, Math.min(cap, 20000), 1000); if (amt) act(() => g.takeLoan(p, amt)); }, { disabled: cap < 1000 || p.creditScore < 550 }));
      if (p.debt > 0) $('#bankDebt').appendChild(btn('Pay down credit line', async () => { const amt = await askAmount('Pay credit line', `Debt ${fmtMoney(p.debt)}.`, Math.min(p.debt, Math.max(0, p.cash))); if (amt) act(() => g.payDebt(p, amt)); }, { disabled: p.cash <= 0 }));
    }
    const m = $('#bankMort'); const mine = g.playerProperties(p).filter(pr => pr.mortgage);
    if (!mine.length) m.innerHTML = '<span class="muted">No mortgages. Use the Properties tab to borrow against a building.</span>';
    mine.forEach(pr => { const row = document.createElement('div'); row.style.marginBottom = '4px'; row.innerHTML = `<a href="#" style="color:inherit">${esc(pr.name)}</a>: <b>${fmtMoney(pr.mortgage.balance)}</b> @ ${pr.mortgage.rate}% · ${fmtMoney(pr.mortgage.payment)}/mo · LTV ${pct(pr.mortgage.balance / g.propertyValue(pr))}`; row.querySelector('a').onclick = ev => { ev.preventDefault(); ui.selectedProp = pr.id; ui.tab = 'properties'; render(); }; m.appendChild(row); });
  }

  function renderStocks(body, p) {
    const g = ui.game; const me = canAct(p);
    const val = g.stocksValue(p), gain = val - p.stockBasis;
    body.innerHTML = `<div class="grid2"><div class="box"><h3>Index fund</h3><div class="kv">
        <span class="k">Price</span><span class="v">${g.eco.stockIndex.toFixed(2)}</span>
        <span class="k">Your holding</span><span class="v"><b>${fmtMoney(val)}</b></span>
        <span class="k">Cost basis</span><span class="v">${fmtMoney(p.stockBasis)}</span>
        <span class="k">Unrealized gain</span><span class="v ${gain >= 0 ? 'good' : 'bad'}">${fmtMoney(gain)}</span>
        <span class="k">Dividends</span><span class="v">2%/yr, paid monthly (${fmtMoney(val * 0.02 / 12)}/mo)</span>
        <span class="k">Trading fee</span><span class="v">${p.freeTrade ? '<span class="good">waived this turn</span>' : '0.5%'} · 20% capital gains tax on profits when selling</span>
      </div><div id="stockBtns" style="margin-top:8px;display:flex;gap:4px"></div></div>
      <div class="box"><h3>History</h3><canvas class="chart" id="chart" width="600" height="140"></canvas><div class="muted" style="font-size:11px">Blue: property index. Green: stock index. Dotted: interest rate ×10.</div></div></div>`;
    if (me) {
      $('#stockBtns').appendChild(btn('Buy', async () => { const amt = await askAmount('Buy index fund', `Cash ${fmtMoney(p.cash)}. 0.5% fee.`, Math.max(0, Math.floor(p.cash / 1.005)), Math.min(10000, Math.floor(p.cash / 1.005)), 100); if (amt) act(() => g.buyStocks(p, amt)); }, { disabled: p.cash < 100 }));
      $('#stockBtns').appendChild(btn('Sell', async () => { const amt = await askAmount('Sell index fund', `Holding ${fmtMoney(val)}.`, val, val, 100); if (amt) act(() => g.sellStocks(p, amt)); }, { disabled: val < 1 }));
    }
    drawChart($('#chart'), g.eco.history);
  }
  function drawChart(cv, hist) {
    if (!cv || hist.length < 2) return;
    const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    const series = [['market', '#4dabf7', false], ['stock', '#51cf66', false], ['rate', '#ffd43b', true]];
    const vals = hist.flatMap(h => [h.market, h.stock, h.rate * 10]); const max = Math.max(...vals) * 1.05, min = Math.min(0, ...vals);
    const x = i => i / (hist.length - 1) * (W - 10) + 5, y = v => H - 5 - (v - min) / (max - min) * (H - 10);
    ctx.strokeStyle = '#2b323c'; ctx.beginPath(); ctx.moveTo(0, y(100)); ctx.lineTo(W, y(100)); ctx.stroke();
    series.forEach(([k, color, dotted]) => { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash(dotted ? [3, 3] : []); ctx.beginPath(); hist.forEach((h, i) => { const v = k === 'rate' ? h.rate * 10 : h[k]; if (i === 0) ctx.moveTo(x(i), y(v)); else ctx.lineTo(x(i), y(v)); }); ctx.stroke(); });
    ctx.setLineDash([]);
  }

  function renderNews(body) {
    const g = ui.game;
    body.innerHTML = `<div class="box"><h3>Active conditions</h3>${g.activeEvents.length ? g.activeEvents.map(ev => `<div class="news-item event"><div class="h">${esc(ev.headline)} <span class="muted">· ${ev.monthsLeft} months left</span></div><div class="d">${esc(ev.desc)}</div></div>`).join('') : '<span class="muted">No active shocks. Business cycle: ' + esc(g.eco.cycle) + '.</span>'}
      ${Object.keys(g.districtShift).length ? `<div class="muted" style="font-size:12px;margin-top:6px">Permanent district shifts: ${Object.entries(g.districtShift).map(([d, v]) => `${D.DISTRICTS[d].name} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`).join(', ')}</div>` : ''}
      ${g.rentCap('residential') < 1 ? '<div class="warn" style="font-size:12px">Rent control in force: residential rents capped at 80% of market.</div>' : ''}</div>
      <div class="box"><h3>Headlines</h3>${g.news.map(n => `<div class="news-item ${n.kind}"><div class="h"><span class="muted">${esc(g.dateLabel(n.month))}</span> ${esc(n.headline)}</div><div class="d">${esc(n.desc)}</div></div>`).join('')}</div>`;
  }

  function renderPlayers() {
    const g = ui.game;
    $('#players').innerHTML = g.players.map(p => {
      const nw = g.netWorth(p); const out = !g.isActive(p);
      return `<div class="pcard ${g.current && g.current.id === p.id ? 'turn' : ''} ${out ? 'out' : ''} ${ui.viewPlayer === p.id ? 'sel' : ''}" data-p="${p.id}" style="border-left-color:${p.color}">
        <div class="top"><b>${esc(p.name)}${p.isAI ? ' <span class="muted" style="font-weight:400">AI</span>' : ''}</b><span>${out ? `<span class="bad">${p.bankrupt ? 'BANKRUPT' : 'DECEASED'}</span>` : `<b>${fmtMoney(nw, true)}</b>`}</span></div>
        <div class="sub"><span>${esc(p.bgTitle)}</span><span>cash <span class="${p.cash < 0 ? 'bad' : ''}">${fmtMoney(p.cash, true)}</span></span><span>${g.playerProperties(p).length} prop</span><span>age ${p.age}</span>${p.debt > 0 ? `<span class="bad">debt ${fmtMoney(p.debt, true)}</span>` : ''}${p.skipTurns > 0 ? `<span class="warn">${esc(p.skipReason)}</span>` : ''}${p.laidOff > 0 ? '<span class="warn">laid off</span>' : ''}</div>
        <div class="hbar"><div style="width:${p.health}%;height:100%;border-radius:2px;background:${p.health < 40 ? 'var(--bad)' : p.health < 65 ? 'var(--warn)' : 'var(--good)'}"></div></div></div>`;
    }).join('');
    $('#players').querySelectorAll('.pcard').forEach(c => { c.onclick = () => { ui.viewPlayer = Number(c.dataset.p); render(); }; });
  }

  function renderSide() {
    const g = ui.game; if (!g) return; const panel = $('#sidePanel');
    if (ui.sideTab === 'news') { renderNews(panel); return; }
    const entries = g.log.slice(-120);
    panel.innerHTML = entries.map(e => { const p = e.player === null ? null : g.players[e.player]; return `<div class="log-line ${e.type}"><span class="d">${esc(g.dateLabel(e.month))}</span>${p ? `<span class="pn" style="color:${p.color}">●</span> ` : ''}${esc(e.text)}</div>`; }).join('');
    panel.scrollTop = panel.scrollHeight;
  }

  /* ---------------- reports ---------------- */
  function showYearReport(report) {
    const g = ui.game;
    const rows = report.rows.map((r, i) => `<tr><td>${i + 1}</td><td style="color:${r.player.color}">${esc(r.player.name)}</td><td class="r">${fmtMoney(r.salary, true)}</td><td class="r">${fmtMoney(r.rent, true)}</td><td class="r">${fmtMoney(r.propExpenses, true)}</td><td class="r">${fmtMoney(r.taxable, true)}</td><td class="r bad">${fmtMoney(r.tax + r.wealthTax, true)}</td><td class="r">${fmtMoney(r.oop, true)}</td><td class="r"><b>${fmtMoney(r.netWorth, true)}</b></td></tr>${r.note ? `<tr><td></td><td colspan="8" class="muted">${esc(r.note)}</td></tr>` : ''}`).join('');
    const html = `<table class="t"><thead><tr><th>#</th><th>Player</th><th class="r">Wages</th><th class="r">Rent</th><th class="r">Prop. costs</th><th class="r">Taxable</th><th class="r">Tax due</th><th class="r">Medical</th><th class="r">Net worth</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="muted" style="font-size:12px;margin-top:8px">Economy: ${esc(g.eco.cycle)}. Property index ${Math.round(g.eco.marketIndex)}, stocks ${Math.round(g.eco.stockIndex)}, rates ${g.eco.interestRate.toFixed(2)}%, inflation ${g.eco.inflation.toFixed(1)}%. Salaries and living costs adjusted for inflation. Everyone is a year older.</div>`;
    if (ui.humans === 0 && ui.aiSpeed === 0) return Promise.resolve();
    return showModal({ title: `${report.year} annual report`, text: 'Income taxes have been paid.', html, options: [{ id: 'ok', label: 'Continue' }] });
  }
  function showGameOver(ranking) {
    const g = ui.game;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    const rows = ranking.map((p, i) => `<tr><td>${i === 0 && g.isActive(p) ? '🏆' : i + 1}</td><td style="color:${p.color}">${esc(p.name)}</td><td>${esc(p.bgTitle)}</td><td class="r">${fmtMoney(p.startNetWorth, true)}</td><td class="r"><b>${g.isActive(p) ? fmtMoney(g.netWorth(p), true) : (p.bankrupt ? 'bankrupt' : 'deceased')}</b></td><td class="r">${g.playerProperties(p).length}</td><td class="r">${fmtMoney(p.stats.taxes, true)}</td><td class="r">${fmtMoney(p.stats.medical, true)}</td></tr>`).join('');
    showModal({ title: 'Game over', text: g.winner ? `${g.winner.name} wins with a net worth of ${fmtMoney(g.netWorth(g.winner))}.` : 'Nobody made it.', html: `<table class="t"><thead><tr><th>#</th><th>Player</th><th>Start</th><th class="r">Start NW</th><th class="r">Final NW</th><th class="r">Props</th><th class="r">Taxes</th><th class="r">Medical</th></tr></thead><tbody>${rows}</tbody></table>`, options: [{ id: 'menu', label: 'Back to menu' }, { id: 'stay', label: 'Look at the board' }] })
      .then(r => { if (r === 'menu') location.reload(); else render(); });
  }

  /* ---------------- side tabs / buttons ---------------- */
  document.querySelectorAll('[data-side]').forEach(b => { b.onclick = () => { ui.sideTab = b.dataset.side; document.querySelectorAll('[data-side]').forEach(x => x.classList.toggle('active', x === b)); renderSide(); }; });
  $('#saveBtn').onclick = () => { save(); toast('Game saved in this browser', 'good'); };
  $('#quitBtn').onclick = async () => { const r = await showModal({ title: 'Back to menu?', text: 'The game is saved at the start of each human turn. You can continue it from the menu.', options: [{ id: 'yes', label: 'Save and leave' }, { id: 'no', label: 'Stay' }] }); if (r === 'yes') { save(); location.reload(); } };

  initSetup();
  window.REC = ui;
})();
