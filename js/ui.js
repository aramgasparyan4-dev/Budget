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
  const money = (n, short) => fmtMoney(n, short === undefined ? true : short);
  const SAVE_KEY = 'real-estate-capital-save';
  const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const ICONS = { home: '🏠', hospital: '🏥', exchange: '📈', court: '⚖️', tax: '🧾', bank: '🏦', job: '💼', casino: '🎰', airport: '✈️', life: '🎲', property: '🏢',
    buy: '🏢', notice: 'ℹ️', offer: '🤝', medical: '🏥', gain: '💰', loss: '💸', warn: '⚠️', news: '📰', deal: '🤝', tax_: '🧾', statement: '📒', info: '·' };

  const ui = { game: null, tab: 'home', selectedProp: null, waiting: null, aiSpeed: 350, view: null, filter: 'all', queued: false, humans: 0 };

  /* ---------------- setup ---------------- */
  function renderSetup() {
    let saved = null; try { saved = localStorage.getItem(SAVE_KEY); } catch (e) { /* ignore */ }
    $('#app').innerHTML = `<div class="setup">
      <h1>Real Estate Capital</h1>
      <p class="tag">A property board game where the economy is real. You start with whatever life handed you, buy and sell in one open market, pay your taxes, and hope the next headline is not about you.</p>
      <div class="setup-grid">
        <div class="card"><h2>Who is playing?</h2><div id="rows"></div><button class="btn small" id="add">+ Add player</button>
          <div class="opts">
            <div class="muted" style="font-size:13px">Click a token to change it. Everyone is dealt a different start in life.</div>
            <label>Game length <select id="years"><option value="3">3 years (quick)</option><option value="5" selected>5 years</option><option value="10">10 years</option><option value="20">20 years</option></select></label>
            <label>Computer speed <select id="speed"><option value="350">Normal</option><option value="120">Fast</option><option value="0">Instant</option></select></label>
          </div>
          <details class="teacher"><summary>Teacher options: scenario, government policy, classroom mode</summary><div class="opts">
            <label>Scenario <select id="scenario">${Object.entries(D.SCENARIOS).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('')}</select></label>
            <div class="muted" id="scenarioDesc" style="font-size:13px;margin-top:-4px"></div>
            <label>Government policy <select id="policy">${Object.entries(D.POLICIES).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('')}</select></label>
            <div class="muted" id="policyDesc" style="font-size:13px;margin-top:-4px"></div>
            <label>Classroom mode <input type="checkbox" id="classroom"></label>
            <div class="muted" style="font-size:13px;margin-top:-4px">No casino or gambling events, no divorce. Everything else stays real.</div>
          </div></details>
          <div class="start"><button class="btn primary big" id="start" style="width:auto">Start game</button>${saved ? '<button class="btn big" id="cont" style="width:auto">Continue saved game</button>' : ''}</div>
        </div>
        <div class="card"><h2>How to play</h2><div class="howto">
          <div><span class="ic">🎲</span><div><b>Roll, land, decide.</b> Land on an empty building and you can buy it. Land on someone else's and you pay a month of rent.</div></div>
          <div><span class="ic">📅</span><div><b>Each round is a month.</b> Salary comes in, bills and mortgages go out. Every December you pay income tax.</div></div>
          <div><span class="ic">🏢</span><div><b>Buildings need care.</b> Repair and renovate them, insure them, or watch them lose tenants and value.</div></div>
          <div><span class="ic">📰</span><div><b>The world happens to you.</b> Recessions, rate hikes, hurricanes, rent control, a broken leg. Keep some cash aside.</div></div>
          <div><span class="ic">🏆</span><div><b>Highest net worth wins</b> when time runs out. Run out of money and credit, and the bank takes everything.</div></div>
        </div></div>
      </div></div><div id="modal" class="modal" hidden><div class="mbox" id="mbox"></div></div><div class="toasts" id="toasts"></div>`;
    const rows = $('#rows');
    const addRow = (name, ai) => { const i = rows.children.length; const r = document.createElement('div'); r.className = 'prow'; r.innerHTML = `<button type="button" class="avatar tokpick" title="Click to change your token" style="background:${D.COLORS[i]}" data-t="${i % D.TOKENS.length}">${D.TOKENS[i % D.TOKENS.length]}</button><input type="text" value="${esc(name)}" maxlength="14"><select><option value="h"${ai ? '' : ' selected'}>Human</option><option value="ai"${ai ? ' selected' : ''}>Computer</option></select><button class="btn small ghost danger">✕</button>`; r.lastElementChild.onclick = () => { if (rows.children.length > 2) { r.remove(); [...rows.children].forEach((x, k) => { x.firstElementChild.style.background = D.COLORS[k]; }); } }; const tp = r.querySelector('.tokpick'); tp.onclick = () => { const n = (Number(tp.dataset.t) + 1) % D.TOKENS.length; tp.dataset.t = n; tp.textContent = D.TOKENS[n]; }; rows.appendChild(r); };
    addRow('You', false); addRow('Dana', true); addRow('Marcus', true);
    const descs = () => { $('#scenarioDesc').textContent = D.SCENARIOS[$('#scenario').value].desc; $('#policyDesc').textContent = D.POLICIES[$('#policy').value].desc; };
    $('#scenario').onchange = descs; $('#policy').onchange = descs; descs();
    $('#add').onclick = () => { if (rows.children.length < 6) addRow(['Priya', 'Leo', 'Sofia'][rows.children.length - 3] || 'Player', true); };
    $('#start').onclick = () => {
      const used = new Set();
      const players = [...rows.children].map(r => { let t = D.TOKENS[Number(r.querySelector('.tokpick').dataset.t)]; if (used.has(t)) t = D.TOKENS.find(x => !used.has(x)) || t; used.add(t); return { name: r.querySelector('input').value.trim() || 'Player', isAI: r.querySelector('select').value === 'ai', token: t }; });
      ui.aiSpeed = Number($('#speed').value);
      startGame(new Game({ players, years: Number($('#years').value), scenario: $('#scenario').value, policy: $('#policy').value, classroom: $('#classroom').checked }));
    };
    if (saved) $('#cont').onclick = () => { try { ui.aiSpeed = Number($('#speed').value); startGame(Game.fromJSON(JSON.parse(saved))); } catch (e) { console.error(e); toast('Saved game could not be loaded', 'bad'); } };
  }

  /* ---------------- controllers ---------------- */
  class HumanController {
    async preRoll(p) {
      if (ui.humans > 1) await modal({ playerName: p.name, icon: '👋', title: `${p.name}, your turn`, text: `Pass the device to ${p.name}.`, options: [{ id: 'ok', label: "I'm ready" }] });
      ui.view = p.id;
      if (!ui.tipsShown) { ui.tipsShown = true; await showTips(p); }
      await waitFor('roll');
    }
    async postRoll(p) { ui.view = p.id; await waitFor('end'); }
    async decide(p, spec) {
      if (spec.type === 'buy') { const pr = ui.game.prop(spec.propertyId); const closing = p.freeTrade ? 0 : Math.round(ui.game.marketPrice(pr) * D.COSTS.closingCost); return modal(Object.assign({ playerName: p.name }, spec, { title: `You landed on ${pr.name}`, text: '', html: deedHtml(pr, p) + `<p class="muted" style="font-size:13px">Nobody owns it. Buying adds ${money(closing, false)} in closing costs.</p>` })); }
      return modal(Object.assign({ playerName: p.name, icon: ICONS[spec.type] || 'ℹ️' }, spec));
    }
    async skipped(p) { await modal({ playerName: p.name, icon: '🛏️', title: 'Turn skipped', text: `${p.name} is ${p.skipReason} this month.`, options: [{ id: 'ok', label: 'OK' }] }); }
  }
  function deedHtml(pr, p) {
    const g = ui.game, d = D.DISTRICTS[pr.district];
    const asOwner = Object.assign({}, pr, { owner: p ? p.id : -1 });
    const visit = g.grossRent(asOwner), month = Math.round(visit * g.targetOccupancy(pr));
    const up = Math.round(g.renovateCost(pr));
    return `<div class="deed"><div class="deed-top" style="background:${d.color}"><span>Title deed</span><b>${esc(pr.name)}</b><span>${esc(d.name)}</span></div><div class="deed-body">
      <div><span>Price</span><b>${money(g.marketPrice(pr), false)}</b></div>
      <div><span>Rent when someone lands here</span><b>${money(visit, false)}</b></div>
      <div><span>Rent from tenants each month</span><b>about ${money(month, false)}</b></div>
      <div><span>Each house you add</span><b>+12% rent, costs ${money(up)}</b></div>
      <div><span>Own all of ${esc(d.name)}</span><b>+25% rent</b></div>
      <div><span>Condition</span><b>${Math.round(pr.condition)} / 100</b></div></div></div>`;
  }
  function showTips(p) {
    return modal({ playerName: p.name, icon: '🎲', title: 'Quick start', html: `<div class="howto" style="margin-bottom:14px">
      <div><span class="ic">1️⃣</span><div><b>Roll.</b> Your ${p.token} moves. Land on an empty property and you can buy it. Land on someone else's and you pay rent.</div></div>
      <div><span class="ic">2️⃣</span><div><b>Every round is a month.</b> You get paid and pay your bills automatically. Check "Last month" on the right.</div></div>
      <div><span class="ic">3️⃣</span><div><b>Build up.</b> Add houses to your properties for more rent. Keep some cash for surprises.</div></div>
      <div><span class="ic">⌨️</span><div><b>Tip:</b> press Enter or Space to roll and to end your turn.</div></div></div>`, options: [{ id: 'ok', label: "Let's play" }] });
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
    const m = $('#modal'); if (m && !m.hidden) return;
    if (ui.game && e.key === ' ') e.preventDefault();
    if ($('#rollBtn')) { e.preventDefault(); done('roll'); } else if ($('#endBtn')) { e.preventDefault(); done('end'); }
  });
  function waitFor(kind) { return new Promise(resolve => { ui.waiting = { kind, resolve }; render(); }); }
  function done(kind) { if (ui.waiting && ui.waiting.kind === kind) { const r = ui.waiting.resolve; ui.waiting = null; r(); render(); } }

  /* ---------------- modal ---------------- */
  let chain = Promise.resolve();
  function modal(spec) {
    const run = () => new Promise(resolve => {
      const box = $('#mbox'); $('#modal').hidden = false; box.classList.toggle('wide', !!spec.wide);
      let h = '';
      if (spec.icon) h += `<div class="ic">${spec.icon}</div>`;
      if (spec.playerName) h += `<div class="for">${esc(spec.playerName)}</div>`;
      h += `<h2>${esc(spec.title || '')}</h2>`;
      if (spec.text) h += `<div class="text">${esc(spec.text)}</div>`;
      if (spec.html) h += spec.html;
      if (spec.amount) h += `<div class="amt"><input type="number" id="amt" min="${spec.amount.min || 0}" max="${spec.amount.max}" step="100" value="${Math.round(spec.amount.value === undefined ? spec.amount.max : spec.amount.value)}"><button class="btn small" id="amtMax">Max ${money(spec.amount.max)}</button></div>`;
      h += '<div class="opts">' + (spec.options || [{ id: 'ok', label: 'OK' }]).map(o => `<button class="opt" data-id="${esc(o.id)}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}${o.desc ? `<span class="desc">${esc(o.desc)}</span>` : ''}</button>`).join('') + '</div>';
      box.innerHTML = h;
      if (spec.amount) $('#amtMax').onclick = () => { $('#amt').value = Math.round(spec.amount.max); };
      if (spec.onRender) { try { spec.onRender(box); } catch (e) { console.error(e); } }
      box.querySelectorAll('.opt').forEach(b => { b.onclick = () => { $('#modal').hidden = true; resolve(spec.amount ? { id: b.dataset.id, amount: Number($('#amt').value) } : b.dataset.id); }; });
      const f = box.querySelector('.opt:not(:disabled)'); if (f) f.focus();
    });
    const p = chain.then(run, run); chain = p.catch(() => {}); return p;
  }
  async function askAmount(title, text, max, value, min) {
    if (max <= 0) { toast('Nothing available', 'bad'); return null; }
    const r = await modal({ title, text, amount: { max, value, min: min || 0 }, options: [{ id: 'ok', label: 'Confirm' }, { id: 'cancel', label: 'Cancel' }] });
    if (r.id !== 'ok' || !(r.amount > 0)) return null;
    return Math.min(r.amount, max);
  }
  function toast(msg, kind) { const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3600); }
  function act(fn) { const r = fn(); if (r && r.msg) toast(r.msg, r.ok ? 'good' : 'bad'); render(); }

  /* ---------------- start ---------------- */
  function startGame(game) {
    ui.game = game; ui.tab = 'home'; ui.selectedProp = null; ui.waiting = null; ui.tipsShown = game.players.every(p => p.isAI) || game.month > 0; ui.animPos = {};
    ui.humans = game.players.filter(p => !p.isAI).length;
    game.players.forEach(p => {
      if (p.isAI) game.setController(p.id, new AIController(game, { delay: () => sleep(ui.aiSpeed), onDecision: (pl, spec, r) => { const o = spec.options.find(x => x.id === r); if (o && spec.type === 'buy' && r !== 'pass') toast(`${pl.name} buys ${game.prop(spec.propertyId).name}`); } }));
      else game.setController(p.id, new HumanController());
    });
    game.on('change', render);
    game.on('log', () => renderFeed());
    game.on('news', n => toast(n.headline, n.kind === 'event' ? 'bad' : ''));
    game.on('openTab', t => { ui.tab = t === 'stocks' ? 'bank' : t; render(); });
    game.on('medical', ({ player, kind, oop }) => toast(`${player.name}: ${kind.name}, pays ${money(oop, false)}`, 'bad'));
    game.on('turnStart', p => { if (!p.isAI) save(); });
    game.on('turnEnd', () => { ui.waiting = null; });
    game.on('gameover', showGameOver);
    game.hooks.yearEnd = showYearReport;
    game.hooks.moved = async ({ player, from, to }) => {
      const stepMs = player.isAI ? (ui.aiSpeed === 0 ? 0 : 70) : 90;
      if (!stepMs) return;
      let pos = from; const steps = (to - from + 40) % 40;
      for (let i = 0; i < steps; i++) { pos = (pos + 1) % 40; ui.animPos[player.id] = pos; renderBoard(); await sleep(stepMs); }
      delete ui.animPos[player.id]; renderBoard();
    };
    const h = game.players.find(p => !p.isAI); ui.view = h ? h.id : 0;
    buildGame(); render(); renderFeed();
    if (!game.over) game.run().catch(e => { console.error(e); toast('Error: ' + e.message, 'bad'); });
    else showGameOver(game.finalRanking());
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(ui.game.toJSON())); } catch (e) { /* ignore */ } }

  function cellPos(i) { if (i <= 10) return [11, 11 - i]; if (i <= 20) return [11 - (i - 10), 1]; if (i <= 30) return [1, 1 + (i - 20)]; return [1 + (i - 30), 11]; }
  function buildGame() {
    $('#app').innerHTML = `<div class="game"><div class="top" id="top"></div><div class="main"><div class="board" id="board"></div><div id="centreSlot"></div><div class="rail"><div class="turn" id="turn"></div><div class="feed" id="feed"></div><div class="players" id="players"></div></div></div></div><div id="modal" class="modal" hidden><div class="mbox" id="mbox"></div></div><div class="toasts" id="toasts"></div>`;
    const board = $('#board');
    D.BOARD.forEach((sp, i) => {
      const c = document.createElement('div'); const corner = i % 10 === 0;
      c.className = 'cell' + (sp.kind === 'property' ? '' : ' sp') + (corner ? ' corner' : ''); c.dataset.i = i;
      const [r, col] = cellPos(i); c.style.gridRow = r; c.style.gridColumn = col;
      c.onclick = () => { if (sp.kind === 'property') { ui.selectedProp = i; ui.tab = 'properties'; render(); } else toast(SPACE_HELP[sp.kind]); };
      board.appendChild(c);
    });
    const fill = document.createElement('div'); fill.className = 'fill'; board.appendChild(fill);
    const centre = document.createElement('div'); centre.className = 'centre'; centre.id = 'centre'; board.appendChild(centre);
    const mq = window.matchMedia('(max-width: 900px)');
    const place = () => { const target = mq.matches ? $('#centreSlot') : $('#board'); if (target && centre.parentElement !== target) target.appendChild(centre); };
    place(); if (mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);
  }
  const SPACE_HELP = { home: 'Home: a quiet month. Health +2.', hospital: 'Hospital: a check-up, and treatment if you need it.', exchange: 'Stock Exchange: trading fees and closing costs waived this turn.', court: 'Courthouse: lawsuits, fines, jury duty.', tax: 'Tax Office: audits and refunds.', bank: 'Bank: consolidate debt, mortgage promo.', job: 'Job Center: promotions, offers, layoffs.', casino: 'Casino: bet if you dare. (Classroom mode: a community fundraiser instead.)', airport: 'Airport: a vacation or a business trip.', life: 'Life: something happens.' };

  /* ---------------- render ---------------- */
  function render() {
    if (ui.queued) return; ui.queued = true;
    requestAnimationFrame(() => { ui.queued = false; if (!ui.game || !$('#board')) return; try { renderTop(); renderBoard(); renderCentre(); renderTurn(); renderPlayers(); } catch (e) { console.error(e); } });
  }
  function viewP() { const g = ui.game; return g.players[ui.view === null ? 0 : ui.view] || g.players[0]; }
  function actor() { const g = ui.game; return ui.waiting && g.current && !g.current.isAI ? g.current : null; }
  const canAct = p => { const a = actor(); return !!a && a.id === p.id; };

  function renderTop() {
    const g = ui.game, e = g.eco;
    const cyc = { expansion: ['Growing', 'good'], peak: ['Overheating', 'warn'], recession: ['Recession', 'bad'], recovery: ['Recovering', 'good'] }[e.cycle];
    const h = e.history; const prev = h.length > 12 ? h[h.length - 13].market : h[0].market; const yoy = (e.marketIndex / prev - 1) * 100;
    $('#top').innerHTML = `<div><div class="date">${esc(g.dateLabel())}</div><div class="sub">Year ${Math.floor(g.month / 12) + 1} of ${g.cfg.years}</div></div>
      <div class="stats"><span>Economy <span class="chip ${cyc[1]}">${cyc[0]}</span></span><span>Property prices <b>${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%</b> this year</span><span>Interest rate <b>${e.interestRate.toFixed(1)}%</b></span><span>Stocks <b>${Math.round(e.stockIndex)}</b></span><span title="${esc(g.policy.desc)}">Policy <b>${esc(g.policy.name)}</b></span>
      ${g.activeEvents.map(ev => `<span class="chip warn" title="${esc(ev.desc)}">${esc(ev.name)}</span>`).join('')}</div>
      <span class="spacer"></span><button class="btn small" id="helpBtn">Help</button><button class="btn small" id="menuBtn">Save &amp; menu</button>`;
    $('#helpBtn').onclick = showHelp;
    $('#menuBtn').onclick = async () => { const r = await modal({ icon: '💾', title: 'Leave the game?', text: 'Your game is saved in this browser. Continue it from the menu any time.', options: [{ id: 'yes', label: 'Save and go to menu' }, { id: 'no', label: 'Keep playing' }] }); if (r === 'yes') { save(); location.reload(); } };
  }
  function renderBoard() {
    const g = ui.game;
    document.querySelectorAll('.cell').forEach(c => {
      const i = Number(c.dataset.i), sp = D.BOARD[i];
      const posOf = p => (ui.animPos[p.id] !== undefined ? ui.animPos[p.id] : p.position);
      const toks = g.players.filter(p => g.isActive(p) && posOf(p) === i).map(p => `<span class="tok" style="border-color:${p.color}" title="${esc(p.name)}">${p.token}</span>`).join('');
      c.classList.toggle('here', !!(g.current && posOf(g.current) === i));
      if (sp.kind !== 'property') { const cl = sp.kind === 'casino' && g.cfg.classroom ? D.CLASSROOM.casino : sp; c.innerHTML = `<div class="ic">${cl.icon}</div><div class="name">${esc(cl.name)}</div><div class="toks">${toks}</div>`; return; }
      const pr = g.prop(i), d = D.DISTRICTS[pr.district], owner = pr.owner === null ? null : g.players[pr.owner];
      c.innerHTML = `<div class="stripe" style="background:${d.color}"></div>${pr.listedPrice !== null ? '<span class="tag">SALE</span>' : ''}<div class="body"><div class="name">${esc(pr.name)}</div><div class="val">${money(g.propertyValue(pr))}${pr.renovation ? ` <span class="houses">${'🏠'.repeat(pr.renovation)}</span>` : ''}</div><div class="toks">${toks}</div></div><div class="own" style="background:${owner ? owner.color : 'transparent'}"></div>`;
      c.title = owner ? `${pr.name} — owned by ${owner.name}` : `${pr.name} — for sale`;
    });
  }
  function renderTurn() {
    const g = ui.game, cur = g.current, a = actor();
    const p = a || cur || viewP();
    const nw = g.netWorth(p), net = g.monthlyIncome(p) - g.monthlyObligations(p);
    let hint, button = '';
    if (g.over) hint = 'The game is over.';
    else if (a && ui.waiting.kind === 'roll') { hint = 'Check your buildings and the market if you like, then roll.'; button = '<button class="btn primary big" id="rollBtn">🎲 Roll the dice</button>'; }
    else if (a) { hint = 'Buy, sell or borrow if you want to. Then end your turn.'; button = '<button class="btn primary big" id="endBtn">End turn ➜</button>'; }
    else if (cur) hint = cur.isAI ? `${cur.name} is playing…` : `${cur.name} is deciding…`;
    else hint = 'Closing the month…';
    const lm = p.lastMonth;
    $('#turn').innerHTML = `<div class="who"><span class="avatar" style="background:${p.color}">${p.token}</span><div><b>${a ? 'Your turn, ' : ''}${esc(p.name)}</b><div class="muted">${esc(p.bgTitle)} · age ${p.age}${p.laidOff > 0 ? ' · <span class="bad">laid off</span>' : ''}${p.inDefault ? ' · <span class="bad">IN DEFAULT</span>' : ''}</div></div></div>
      <div class="nums"><div><div class="l">Cash</div><div class="v ${p.cash < 0 ? 'bad' : ''}">${money(p.cash, false)}</div></div><div><div class="l">Net worth</div><div class="v">${money(nw)}</div></div><div><div class="l">Monthly</div><div class="v ${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : ''}${money(net)}</div></div><div><div class="l">Health</div><div class="v ${p.health < 40 ? 'bad' : p.health < 65 ? 'warn' : 'good'}">${Math.round(p.health)}</div></div></div>
      ${lm ? `<div class="lastm"><span>Last month</span><span>+${money(lm.income, false)} in · -${money(lm.expenses, false)} out · <b class="${lm.net >= 0 ? 'good' : 'bad'}">${lm.net >= 0 ? '+' : '-'}${money(Math.abs(lm.net), false)}</b></span></div>` : ''}
      ${g.lastRoll && cur ? `<div class="dice">${DICE[g.lastRoll[0] - 1]}${DICE[g.lastRoll[1] - 1]}</div>` : ''}${button}<div class="hint">${esc(hint)}</div>`;
    const rb = $('#rollBtn'); if (rb) rb.onclick = () => done('roll');
    const eb = $('#endBtn'); if (eb) eb.onclick = () => done('end');
  }
  function renderFeed() {
    const g = ui.game; const f = $('#feed'); if (!g || !f) return;
    const humans = g.players.filter(x => !x.isAI).map(x => x.name);
    const entries = g.log.filter(e => { const pl = e.player === null ? null : g.players[e.player]; if (!pl || !pl.isAI) return true; if (['deal', 'medical', 'news', 'tax'].includes(e.type)) return true; return humans.some(n => e.text.includes(n)); }).slice(-60).reverse();
    f.innerHTML = '<h3>What happened</h3>' + entries.map(e => { const p = e.player === null ? null : g.players[e.player]; const ic = e.type === 'news' ? '📰' : e.type === 'medical' ? '🏥' : e.type === 'tax' ? '🧾' : e.type === 'deal' ? '🤝' : e.type === 'statement' ? '📒' : e.type === 'gain' ? '💰' : e.type === 'loss' ? '💸' : e.type === 'warn' ? '⚠️' : (p ? `<span class="avatar" style="background:${p.color};width:16px;height:16px;font-size:9px">${esc(p.name[0])}</span>` : '·'); return `<div class="fi ${e.type}"><span class="ic">${ic}</span><span>${esc(e.text)}</span><span class="d">${esc(g.dateLabel(e.month))}</span></div>`; }).join('');
  }
  function renderPlayers() {
    const g = ui.game;
    $('#players').innerHTML = g.players.map(p => { const out = !g.isActive(p); return `<div class="prow2 ${g.current && g.current.id === p.id ? 'turn' : ''} ${out ? 'out' : ''}" data-p="${p.id}"><span class="avatar" style="background:${p.color}">${p.token}</span><div class="n"><b>${esc(p.name)}${p.isAI ? ' <span>(computer)</span>' : ''}</b><span>${esc(p.bgTitle)} · ${g.playerProperties(p).length} propert${g.playerProperties(p).length === 1 ? 'y' : 'ies'}</span></div><div class="bar hb" title="Health ${Math.round(p.health)}"><div style="width:${p.health}%;background:${p.health < 40 ? 'var(--bad)' : p.health < 65 ? 'var(--warn)' : 'var(--good)'}"></div></div><span class="nw">${out ? `<span class="bad">${p.bankrupt ? 'Bankrupt' : 'Deceased'}</span>` : money(g.netWorth(p))}</span></div>`; }).join('');
    $('#players').querySelectorAll('.prow2').forEach(c => { c.onclick = () => { ui.view = Number(c.dataset.p); ui.tab = 'home'; render(); }; });
  }

  function renderCentre() {
    const p = viewP(); const me = canAct(p);
    const tabs = [['home', 'Overview'], ['properties', 'My properties'], ['market', 'Buy & sell'], ['bank', 'Bank'], ['news', 'News']];
    $('#centre').innerHTML = `<div class="tabs">${tabs.map(([id, l]) => `<button data-t="${id}" class="${ui.tab === id ? 'on' : ''}">${l}</button>`).join('')}<span style="flex:1"></span><span style="padding:7px 10px;font-size:13px;opacity:.8">${me ? 'Managing' : 'Viewing'}: <b>${esc(p.name)}</b></span></div><div class="pane" id="pane"></div>`;
    $('#centre').querySelectorAll('[data-t]').forEach(b => { b.onclick = () => { ui.tab = b.dataset.t; render(); }; });
    ({ home: renderHome, properties: renderProperties, market: renderMarket, bank: renderBank, news: renderNews })[ui.tab]($('#pane'), p, me);
  }
  function btn(label, fn, o) { const b = document.createElement('button'); b.className = 'btn small ' + ((o && o.cls) || ''); b.textContent = label; b.disabled = !!(o && o.disabled); b.title = (o && o.title) || ''; b.onclick = fn; return b; }

  function renderHome(pane, p, me) {
    const g = ui.game; const inc = g.monthlyIncome(p), obl = g.monthlyObligations(p);
    const rent = g.playerProperties(p).reduce((s, pr) => s + g.monthlyRentCollected(pr), 0), pcost = g.playerProperties(p).reduce((s, pr) => s + g.monthlyPropertyCosts(pr).total, 0);
    const loans = p.loans.reduce((s, l) => s + l.payment, 0), prem = p.healthInsurance ? g.healthPremium(p) : 0;
    pane.innerHTML = `<div class="tiles"><div class="tile"><div class="l">Cash</div><div class="v ${p.cash < 0 ? 'bad' : ''}">${money(p.cash, false)}</div></div><div class="tile"><div class="l">Net worth</div><div class="v">${money(g.netWorth(p))}</div></div><div class="tile"><div class="l">Properties</div><div class="v">${g.playerProperties(p).length}</div></div><div class="tile"><div class="l">Credit score</div><div class="v">${Math.round(p.creditScore)}</div></div></div>
      <div class="section"><h3>A typical month</h3><div class="kv">
        <span>${esc(p.job)}${p.laidOff > 0 ? ' (laid off: unemployment benefit)' : ''}</span><span class="v good">+${money(p.laidOff > 0 ? (p.unemploymentLeft > 0 ? p.prevSalary * 0.4 : 0) : p.salary, false)}</span>
        ${p.sideIncome ? `<span>Side income</span><span class="v good">+${money(p.sideIncome, false)}</span>` : ''}
        ${rent ? `<span>Rent from tenants</span><span class="v good">+${money(rent, false)}</span>` : ''}
        ${g.stocksValue(p) ? `<span>Dividends</span><span class="v good">+${money(g.stocksValue(p) * 0.02 / 12, false)}</span>` : ''}
        <span>Living costs${p.children ? ` (${p.children} child${p.children > 1 ? 'ren' : ''})` : ''}</span><span class="v bad">-${money(p.living + p.children * 700, false)}</span>
        ${prem ? `<span>Health insurance</span><span class="v bad">-${money(prem, false)}</span>` : ''}
        ${pcost ? `<span>Property costs (tax, upkeep, mortgages)</span><span class="v bad">-${money(pcost, false)}</span>` : ''}
        ${loans ? `<span>Loan payments</span><span class="v bad">-${money(loans, false)}</span>` : ''}
        ${p.debt ? `<span>Credit line (${money(p.debt)} at ${g.creditRate().toFixed(0)}%)</span><span class="v bad">-${money(p.debt * g.creditRate() / 1200, false)}</span>` : ''}
        <span><b>Left over</b></span><span class="v ${inc - obl >= 0 ? 'good' : 'bad'}">${inc - obl >= 0 ? '+' : ''}${money(inc - obl, false)}</span></div></div>
      <div class="section"><h3>You</h3><div class="kv"><span>Health</span><span class="v ${p.health < 40 ? 'bad' : p.health < 65 ? 'warn' : 'good'}">${Math.round(p.health)} / 100</span><span>Health insurance</span><span class="v">${p.healthInsurance ? 'Yes' : '<span class="bad">None</span>'}</span><span>Stocks</span><span class="v">${money(g.stocksValue(p))}</span><span>Taxes paid so far</span><span class="v">${money(p.stats.taxes)}</span><span>Medical bills so far</span><span class="v">${money(p.stats.medical)}</span></div><div class="actions" id="homeActions"></div></div>`;
    if (me) {
      const a = $('#homeActions');
      a.appendChild(btn(p.healthInsurance ? 'Drop health insurance' : `Get health insurance (${money(g.healthPremium(p), false)}/mo)`, () => act(() => g.setHealthInsurance(p, !p.healthInsurance))));
      if (p.debt > 0) a.appendChild(btn('Pay off credit line', async () => { const amt = await askAmount('Pay credit line', `You owe ${money(p.debt, false)} at ${g.creditRate().toFixed(1)}%.`, Math.min(p.debt, Math.max(0, p.cash))); if (amt) act(() => g.payDebt(p, amt)); }, { disabled: p.cash <= 0 }));
    }
  }

  function propCard(pr, p, me) {
    const g = ui.game, d = D.DISTRICTS[pr.district];
    const value = g.propertyValue(pr), rent = g.monthlyRentCollected(pr), costs = g.monthlyPropertyCosts(pr), net = rent - costs.total;
    const card = document.createElement('div'); card.className = 'pcard'; card.style.borderLeftColor = d.color;
    const condCls = pr.condition < 45 ? 'bad' : pr.condition < 70 ? 'warn' : 'good';
    card.innerHTML = `<div class="h"><b>${esc(pr.name)}</b><span class="muted">${esc(d.name)}${g.ownsDistrict(pr.owner, pr.district) ? ' · ★ whole district' : ''}</span></div>
      <div class="facts"><span>Worth <b>${money(value)}</b></span><span>Earns <b class="${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : ''}${money(net, false)}/mo</b></span><span>Visitors pay <b>${money(g.landingFee(pr), false)}</b></span><span>${'🏠'.repeat(pr.renovation) || 'no houses'}</span>${pr.mortgage ? `<span class="chip">Mortgage ${money(pr.mortgage.balance)}</span>` : ''}${pr.insured ? '<span class="chip good">Insured</span>' : '<span class="chip warn">Not insured</span>'}${pr.listedPrice !== null ? `<span class="chip warn">For sale ${money(pr.listedPrice)}</span>` : ''}</div>
      <div class="cond">Condition <div class="bar"><div style="width:${pr.condition}%;background:var(--${condCls})"></div></div><b class="${condCls}">${Math.round(pr.condition)}</b>${pr.condition < 70 ? '<span class="muted">· losing tenants</span>' : ''}</div>`;
    if (!me) return card;
    const a = document.createElement('div'); a.className = 'actions';
    const rc = g.repairCost(pr), rn = g.renovateCost(pr);
    a.appendChild(btn(`Repair · ${money(rc)}`, () => act(() => g.repair(p, pr.id)), { disabled: rc <= 0 || p.cash < rc, title: 'Back to perfect condition' }));
    a.appendChild(btn(`Add a house · ${money(rn)}`, () => act(() => g.renovate(p, pr.id)), { disabled: pr.renovation >= 3 || p.cash < rn, title: '+12% rent, +10% value. Up to 3 houses.' }));
    a.appendChild(btn(pr.insured ? 'Cancel insurance' : `Insure · ${money(value * D.COSTS.propertyInsuranceRate / 12 * g.insuranceMult(), false)}/mo`, () => act(() => g.setInsured(p, pr.id, !pr.insured)), { title: 'Covers storms, earthquakes and half of lawsuits' }));
    a.appendChild(btn('Sell…', () => sellFlow(p, pr)));
    card.appendChild(a);
    const det = document.createElement('details'); det.innerHTML = '<summary>More options</summary>'; const more = document.createElement('div'); more.className = 'actions';
    const seg = document.createElement('span'); seg.className = 'seg';
    [['low', 'Low rent'], ['market', 'Market rent'], ['high', 'High rent']].forEach(([s, l]) => { const b = document.createElement('button'); b.textContent = l; b.className = pr.strategy === s ? 'on' : ''; b.title = s === 'low' ? '-15% rent, more tenants' : s === 'high' ? '+20% rent, fewer tenants' : 'Normal'; b.onclick = () => act(() => g.setStrategy(p, pr.id, s)); seg.appendChild(b); });
    more.appendChild(seg);
    const maxLoan = Math.round(value * 0.8), cur = pr.mortgage ? pr.mortgage.balance : 0;
    more.appendChild(btn(pr.mortgage ? 'Borrow more against it' : 'Take a mortgage', async () => { const amt = await askAmount(pr.mortgage ? 'Cash-out refinance' : 'Mortgage', `Borrow up to ${money(maxLoan)} (80% of value) at ${g.mortgageRate(p).toFixed(1)}% over 30 years. 1.5% closing cost.${cur ? ` Replaces the current ${money(cur)} loan.` : ''}`, maxLoan, maxLoan, cur + 1000); if (amt) act(() => g.takeMortgage(p, pr.id, amt)); }, { disabled: maxLoan <= cur + 5000 || p.creditScore < 580 }));
    if (pr.mortgage) {
      more.appendChild(btn(`Refinance at ${g.mortgageRate(p).toFixed(1)}%`, () => act(() => g.refinance(p, pr.id)), { disabled: g.mortgageRate(p) >= pr.mortgage.rate }));
      more.appendChild(btn('Pay down mortgage', async () => { const amt = await askAmount('Pay down mortgage', `Balance ${money(pr.mortgage.balance, false)} at ${pr.mortgage.rate}%.`, Math.min(pr.mortgage.balance, Math.max(0, p.cash))); if (amt) act(() => g.payMortgage(p, pr.id, amt)); }, { disabled: p.cash <= 0 }));
    }
    det.appendChild(more); card.appendChild(det);
    return card;
  }
  async function sellFlow(p, pr) {
    const g = ui.game, value = g.propertyValue(pr), qs = Math.round(value * D.COSTS.quickSaleFactor);
    const r = await modal({ icon: '🏷️', title: `Sell ${pr.name}`, text: `Market value ${money(value, false)}.${pr.mortgage ? ` The ${money(pr.mortgage.balance)} mortgage is paid off from the proceeds.` : ''} Profit is taxed at 20%.`, options: [
      pr.listedPrice === null ? { id: 'list', label: 'Offer it to the other players', desc: 'Name your price. They can buy it on their turn. 5% agent fee.' } : { id: 'unlist', label: 'Withdraw the offer', desc: `Currently offered at ${money(pr.listedPrice, false)}.` },
      { id: 'quick', label: `Sell to the bank for ${money(qs, false)}`, desc: '80% of value, cash today, 2% fee.' }, { id: 'cancel', label: 'Keep it' }] });
    if (r === 'list') { const amt = await askAmount('Your asking price', `Market value ${money(value, false)}. Computer players rarely pay more than about 5% over value.`, Math.round(value * 1.5), Math.round(value * 1.05), 1000); if (amt) act(() => g.listProperty(p, pr.id, amt)); }
    else if (r === 'unlist') act(() => g.unlistProperty(p, pr.id));
    else if (r === 'quick') act(() => g.quickSale(p, pr.id));
  }
  function renderProperties(pane, p, me) {
    const g = ui.game; pane.innerHTML = '';
    if (ui.selectedProp !== null) {
      const pr = g.prop(ui.selectedProp); const owner = pr.owner === null ? null : g.players[pr.owner];
      const s = document.createElement('div'); s.className = 'section';
      s.innerHTML = `<h3>${esc(pr.name)} <span class="muted" style="font-size:13px;font-family:var(--body);font-weight:400">· ${owner ? `owned by ${esc(owner.name)}` : 'nobody owns it'}</span></h3><p class="muted" style="margin:0 0 8px;font-size:13px">${esc(D.DISTRICTS[pr.district].desc)}</p>`;
      s.appendChild(propCard(pr, owner || p, !!owner && owner.id === p.id && me));
      const a = document.createElement('div'); a.className = 'actions';
      if (me && !owner) a.appendChild(btn('Buy this building', () => buyFlow(p, pr), { cls: 'primary' }));
      if (me && owner && owner.id !== p.id) { if (pr.listedPrice !== null) a.appendChild(btn(`Buy for ${money(pr.listedPrice)}`, () => buyFlow(p, pr), { cls: 'primary' })); a.appendChild(btn('Make an offer', () => offerFlow(p, pr))); }
      a.appendChild(btn('Close', () => { ui.selectedProp = null; render(); }));
      s.appendChild(a); pane.appendChild(s);
    }
    const mine = g.playerProperties(p);
    const h = document.createElement('div'); h.className = 'section';
    const tn = mine.reduce((s, pr) => s + g.netMonthlyCashflow(pr), 0);
    h.innerHTML = `<h3>${me ? 'Your properties' : esc(p.name) + "'s properties"}</h3><p class="muted" style="margin:0 0 8px;font-size:13px">${mine.length ? `${mine.length} propert${mine.length > 1 ? 'ies' : 'y'}, earning <b class="${tn >= 0 ? 'good' : 'bad'}">${tn >= 0 ? '+' : ''}${money(tn, false)}/month</b> after costs. Buildings wear out every month: keep condition above 70 to keep tenants.` : 'Nothing yet. Land on an empty property, or buy one from the Buy & sell tab.'}</p>`;
    pane.appendChild(h);
    mine.forEach(pr => pane.appendChild(propCard(pr, p, me)));
  }

  async function buyFlow(p, pr) {
    const g = ui.game; const listed = pr.owner !== null;
    const price = listed ? pr.listedPrice : Math.round(g.marketPrice(pr) * (1 + D.COSTS.offMarketPremium));
    const closing = p.freeTrade ? 0 : Math.round(price * D.COSTS.closingCost);
    const loan = Math.round(Math.min(price, g.propertyValue(pr)) * 0.8);
    const rent = Math.round(g.grossRent(Object.assign({}, pr, { owner: p.id })) * g.targetOccupancy(pr));
    const r = await modal({ title: `Buy ${pr.name}?`, html: deedHtml(pr, p) + `<p class="muted" style="font-size:13px">${listed ? `${esc(g.players[pr.owner].name)} is asking ${money(price, false)}` : `Off-market price ${money(price, false)} (5% above value)`}, plus ${money(closing, false)} closing costs.</p>`, options: [
      { id: 'cash', label: `Pay cash · ${money(price + closing, false)}`, disabled: p.cash < price + closing },
      { id: 'mortgage', label: `Mortgage · ${money(price - loan + closing, false)} down`, desc: `Borrow ${money(loan)} at ${g.mortgageRate(p).toFixed(1)}%: about ${money(mortgagePayment(loan, g.mortgageRate(p), 360), false)}/month for 30 years.`, disabled: p.creditScore < 580 || p.cash < price - loan + closing },
      { id: 'cancel', label: 'Not now' }] });
    if (r === 'cancel') return;
    act(() => listed ? g.buyListed(p, pr.id, r === 'mortgage' ? 0.8 : 0) : g.buyProperty(p, pr.id, r === 'mortgage' ? 0.8 : 0));
  }
  async function offerFlow(p, pr) {
    const g = ui.game, value = g.propertyValue(pr);
    const r = await modal({ icon: '🤝', title: `Offer for ${pr.name}`, text: `Owned by ${g.players[pr.owner].name}. Market value ${money(value, false)}. They are more likely to accept above value, or if they are short of cash.`, amount: { max: Math.round(value * 2), value: Math.round(value * 1.1), min: 1000 },
      options: [{ id: 'cash', label: 'Offer, paying cash' }, { id: 'mortgage', label: 'Offer, with an 80% mortgage', disabled: p.creditScore < 580 }, { id: 'cancel', label: 'Cancel' }] });
    if (r.id === 'cancel' || !(r.amount > 0)) return;
    const res = await g.makeOffer(p, pr.id, r.amount, r.id === 'mortgage' ? 0.8 : 0);
    toast(res.msg, res.ok ? 'good' : 'bad'); render();
  }
  function renderMarket(pane, p, me) {
    const g = ui.game; const f = ui.filter;
    let list = g.properties.slice();
    if (f === 'sale') list = list.filter(pr => pr.owner === null || pr.listedPrice !== null);
    if (f === 'others') list = list.filter(pr => pr.owner !== null && pr.owner !== p.id);
    if (f === 'afford') list = list.filter(pr => pr.owner === null && p.cash >= g.marketPrice(pr) * 1.05 * 0.22);
    pane.innerHTML = `<p class="muted" style="margin:0 0 8px;font-size:13px">Every building has one live price. Empty ones cost 5% extra off-market (no extra if you land on them). ${p.freeTrade ? '<b class="good">Closing costs are waived this turn.</b>' : ''}</p>
      <div class="filters">${[['all', 'All'], ['sale', 'For sale'], ['afford', 'I can afford'], ['others', 'Owned by others']].map(([id, l]) => `<button class="btn small ${f === id ? 'on' : ''}" data-f="${id}">${l}</button>`).join('')}</div><div class="mgrid" id="mg"></div>`;
    pane.querySelectorAll('[data-f]').forEach(b => { b.onclick = () => { ui.filter = b.dataset.f; render(); }; });
    const grid = $('#mg');
    list.forEach(pr => {
      const d = D.DISTRICTS[pr.district], owner = pr.owner === null ? null : g.players[pr.owner];
      const rent = owner ? g.monthlyRentCollected(pr) : Math.round(g.grossRent(Object.assign({}, pr, { owner: -1 })) * g.targetOccupancy(pr));
      const c = document.createElement('div'); c.className = 'mcard'; c.style.borderTopColor = d.color;
      c.innerHTML = `<b>${esc(pr.name)}</b><span class="muted" style="font-size:12px">${esc(d.name)}</span><div class="row"><span>Price</span><span>${money(owner ? (pr.listedPrice !== null ? pr.listedPrice : g.propertyValue(pr)) : g.marketPrice(pr) * 1.05)}</span></div><div class="row"><span>Rent</span><span>${money(rent, false)}/mo</span></div><div class="row"><span>Condition</span><span class="${pr.condition < 45 ? 'bad' : pr.condition < 70 ? 'warn' : ''}">${Math.round(pr.condition)}</span></div><div class="own">${owner ? `<span class="dot" style="background:${owner.color}"></span>${esc(owner.name)}${pr.listedPrice !== null ? ' <span class="chip warn">For sale</span>' : ''}` : '<span class="chip good">Available</span>'}</div>`;
      const a = document.createElement('div'); a.className = 'actions';
      if (me && !owner) a.appendChild(btn('Buy', () => buyFlow(p, pr), { cls: 'primary' }));
      else if (me && owner && owner.id !== p.id) { if (pr.listedPrice !== null) a.appendChild(btn('Buy', () => buyFlow(p, pr), { cls: 'primary' })); a.appendChild(btn('Offer', () => offerFlow(p, pr))); }
      else if (owner && owner.id === p.id) a.appendChild(btn('Manage', () => { ui.selectedProp = pr.id; ui.tab = 'properties'; render(); }));
      a.appendChild(btn('Details', () => { ui.selectedProp = pr.id; ui.tab = 'properties'; render(); }, { cls: 'ghost' }));
      c.appendChild(a); grid.appendChild(c);
    });
  }

  function renderBank(pane, p, me) {
    const g = ui.game; const cap = g.loanCapacity(p), val = g.stocksValue(p), gain = val - p.stockBasis;
    pane.innerHTML = `<div class="tiles"><div class="tile"><div class="l">Interest rate</div><div class="v">${g.eco.interestRate.toFixed(1)}%</div></div><div class="tile"><div class="l">Your mortgage rate</div><div class="v">${g.mortgageRate(p).toFixed(1)}%</div></div><div class="tile"><div class="l">Credit score</div><div class="v">${Math.round(p.creditScore)}</div></div></div>
      <div class="section"><h3>Credit line</h3><div class="kv"><span>Owed</span><span class="v ${p.debt > 0 ? 'bad' : ''}">${money(p.debt, false)}</span><span>Limit</span><span class="v">${money(g.creditLimit(p))}</span><span>Rate</span><span class="v bad">${g.creditRate().toFixed(1)}%</span></div><p class="muted" style="font-size:13px;margin:6px 0">Kicks in automatically when your cash runs out. Expensive. If the limit is used up, your stocks and buildings get seized.</p><div class="actions" id="bkDebt"></div></div>
      <div class="section"><h3>Loans</h3><div id="bkLoans"></div><div class="actions" id="bkLoan"></div></div>
      <div class="section"><h3>Mortgages</h3><div id="bkMort"></div></div>
      <div class="section"><h3>Stock market fund</h3><div class="kv"><span>You hold</span><span class="v">${money(val, false)}</span><span>Gain so far</span><span class="v ${gain >= 0 ? 'good' : 'bad'}">${gain >= 0 ? '+' : ''}${money(gain, false)}</span><span>Pays</span><span class="v">2%/yr dividends</span></div><div class="actions" id="bkStock"></div><canvas class="chart" id="chart" width="700" height="150" style="margin-top:8px"></canvas><div class="muted" style="font-size:12px">Blue: property prices. Green: stock fund. Both start at 100.</div></div>`;
    const loans = $('#bkLoans');
    loans.innerHTML = p.loans.length ? '' : '<span class="muted">No loans.</span>';
    p.loans.forEach((l, i) => { const r = document.createElement('div'); r.className = 'actions'; r.style.marginTop = '0'; r.innerHTML = `<span style="flex:1">${esc(l.name)}: <b>${money(l.balance, false)}</b> at ${l.rate}% · ${money(l.payment, false)}/mo, ${l.monthsLeft} months left</span>`; if (me) r.appendChild(btn('Repay', async () => { const amt = await askAmount('Repay', `${l.name}: ${money(l.balance, false)}.`, Math.min(l.balance, Math.max(0, p.cash))); if (amt) act(() => g.repayLoan(p, i, amt)); }, { disabled: p.cash <= 0 })); loans.appendChild(r); });
    const m = $('#bkMort'); const mine = g.playerProperties(p).filter(pr => pr.mortgage);
    m.innerHTML = mine.length ? mine.map(pr => `<div>${esc(pr.name)}: <b>${money(pr.mortgage.balance, false)}</b> at ${pr.mortgage.rate}% · ${money(pr.mortgage.payment, false)}/mo</div>`).join('') : '<span class="muted">No mortgages. Borrow against a building from the My buildings tab.</span>';
    if (me) {
      if (p.debt > 0) $('#bkDebt').appendChild(btn('Pay off credit line', async () => { const amt = await askAmount('Pay credit line', `You owe ${money(p.debt, false)}.`, Math.min(p.debt, Math.max(0, p.cash))); if (amt) act(() => g.payDebt(p, amt)); }, { disabled: p.cash <= 0 }));
      $('#bkLoan').appendChild(btn(`Take a loan (up to ${money(cap)})`, async () => { const amt = await askAmount('Personal loan', `Up to ${money(cap, false)} at ${g.loanRate(p).toFixed(1)}%, repaid over 5 years.`, cap, Math.min(cap, 20000), 1000); if (amt) act(() => g.takeLoan(p, amt)); }, { disabled: cap < 1000 || p.creditScore < 550 }));
      $('#bkStock').appendChild(btn('Invest', async () => { const amt = await askAmount('Invest in the fund', `Cash ${money(p.cash, false)}. 0.5% fee.`, Math.max(0, Math.floor(p.cash / 1.005)), Math.min(10000, Math.floor(p.cash / 1.005)), 100); if (amt) act(() => g.buyStocks(p, amt)); }, { disabled: p.cash < 100 }));
      $('#bkStock').appendChild(btn('Sell', async () => { const amt = await askAmount('Sell fund units', `You hold ${money(val, false)}. 20% tax on profit.`, val, val, 100); if (amt) act(() => g.sellStocks(p, amt)); }, { disabled: val < 1 }));
    }
    drawChart($('#chart'), g.eco.history);
  }
  function drawChart(cv, hist) {
    if (!cv || hist.length < 2) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    const vals = hist.flatMap(h => [h.market, h.stock]); const max = Math.max(...vals) * 1.05, min = Math.min(...vals) * 0.9;
    const x = i => i / (hist.length - 1) * (W - 20) + 10, y = v => H - 10 - (v - min) / (max - min) * (H - 20);
    const cs = getComputedStyle(document.documentElement);
    ctx.strokeStyle = cs.getPropertyValue('--line').trim(); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, y(100)); ctx.lineTo(W, y(100)); ctx.stroke(); ctx.setLineDash([]);
    [['market', cs.getPropertyValue('--accent').trim()], ['stock', cs.getPropertyValue('--good').trim()]].forEach(([k, color]) => { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); hist.forEach((h, i) => { if (i === 0) ctx.moveTo(x(i), y(h[k])); else ctx.lineTo(x(i), y(h[k])); }); ctx.stroke(); });
  }
  function drawWealth(cv, g) {
    const hist = g.eco.history; if (!cv || hist.length < 2) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    const all = hist.flatMap(h => h.netWorth); const max = Math.max(1, ...all), min = Math.min(0, ...all);
    const x = i => i / (hist.length - 1) * (W - 20) + 10, y = v => H - 10 - (v - min) / (max - min) * (H - 20);
    const cs = getComputedStyle(document.documentElement);
    ctx.strokeStyle = cs.getPropertyValue('--line').trim(); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, y(0)); ctx.lineTo(W, y(0)); ctx.stroke(); ctx.setLineDash([]);
    g.players.forEach(p => { ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.beginPath(); hist.forEach((h, i) => { const v = h.netWorth[p.id]; if (i === 0) ctx.moveTo(x(i), y(v)); else ctx.lineTo(x(i), y(v)); }); ctx.stroke(); });
    ctx.fillStyle = cs.getPropertyValue('--muted').trim(); ctx.font = '11px sans-serif'; ctx.fillText(money(max), 12, 12); ctx.fillText(money(min), 12, H - 12);
  }
  function lessonsHtml(g) {
    const ps = g.players.slice().sort((a, b) => g.netWorth(b) - g.netWorth(a));
    const src = ps.map(p => Object.assign({ p }, g.incomeSources(p)));
    const maxSrc = Math.max(1, ...src.flatMap(x => [Math.abs(x.wages), Math.abs(x.rent), Math.abs(x.investing)]));
    const bar = (v, col) => `<div class="hb"><span style="width:${Math.round(Math.abs(v) / maxSrc * 100)}%;background:${col}"></span><em>${v < 0 ? '-' : ''}${money(Math.abs(v))}</em></div>`;
    const top = ps[0], bottom = ps[ps.length - 1];
    const startGap = Math.max(...ps.map(p => p.startNetWorth)) - Math.min(...ps.map(p => p.startNetWorth));
    const endGap = g.netWorth(top) - (g.isActive(bottom) ? g.netWorth(bottom) : 0);
    const richestStart = ps.slice().sort((a, b) => b.startNetWorth - a.startNetWorth)[0];
    const facts = [];
    facts.push(`The gap between richest and poorest was ${money(startGap)} at the start and ${money(endGap)} at the end.`);
    facts.push(richestStart.id === top.id ? `${richestStart.name} started richest and finished richest.` : `${richestStart.name} started richest but ${top.name} finished first.`);
    const assetHeavy = src.filter(x => x.rent + x.investing > x.wages);
    if (assetHeavy.length) facts.push(`${assetHeavy.map(x => x.p.name).join(', ')} made more from owning things than from working.`);
    const taxShare = src.map(x => ({ n: x.p.name, inc: x.wages + Math.max(0, x.rent) + Math.max(0, x.investing), r: (x.taxes - x.estateTax) / Math.max(1, x.wages + Math.max(0, x.rent) + Math.max(0, x.investing)) })).filter(x => x.inc > 20000 && x.r < 0.8);
    const hi = taxShare.sort((a, b) => b.r - a.r)[0], lo = taxShare[taxShare.length - 1];
    if (hi && lo && hi.n !== lo.n) facts.push(`${hi.n} paid about ${Math.round(hi.r * 100)}% of their income in tax; ${lo.n} paid about ${Math.round(lo.r * 100)}%.`);
    const est = src.filter(x => x.estateTax > 0);
    est.forEach(x => facts.push(`${x.p.name} paid ${money(x.estateTax)} in estate tax on what they inherited${g.policy.estateRate === 0 ? '' : ` (${Math.round(g.policy.estateRate * 100)}% above $1M)`}.`));
    const med = src.filter(x => x.medical > 0).sort((a, b) => b.medical - a.medical)[0];
    if (med) facts.push(`${med.p.name} paid ${money(med.medical)} in medical bills${med.p.healthInsurance ? ' even with insurance' : ', uninsured'}.`);
    return `<h3 style="font-size:17px;margin:14px 0 6px">Wealth over time</h3><canvas class="chart" id="wealthChart" width="700" height="170"></canvas><div class="muted" style="font-size:12px;margin-bottom:10px">${ps.map(p => `<span style="color:${p.color}">■</span> ${esc(p.name)} `).join(' ')}</div>
      <h3 style="font-size:17px;margin:14px 0 6px">Where the money came from</h3><div class="twrap"><table class="t srcs"><thead><tr><th>Player</th><th>Working</th><th>Owning buildings</th><th>Investing &amp; price rises</th><th class="r">Taxes</th><th class="r">Medical</th></tr></thead><tbody>${src.map(x => `<tr><td><b style="color:${x.p.color}">${esc(x.p.name)}</b><br><span class="muted">${esc(x.p.bgTitle)}</span></td><td>${bar(x.wages, 'var(--accent)')}</td><td>${bar(x.rent, 'var(--good)')}</td><td>${bar(x.investing, 'var(--gold)')}</td><td class="r">${money(x.taxes)}</td><td class="r">${x.medical ? money(x.medical) : '–'}</td></tr>`).join('')}</tbody></table></div>
      <h3 style="font-size:17px;margin:14px 0 6px">What this game showed</h3><ul class="facts">${facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <h3 style="font-size:17px;margin:14px 0 6px">Talk about it</h3><ul class="facts"><li>Who worked hardest? Who ended richest? Are those the same people?</li><li>What would have happened to the poorest player with a different government policy?</li><li>Which events hurt everyone, and which hurt only some people?</li><li>If you played again from the same start, what would you do differently? What could you not change?</li></ul>`;
  }
  function renderNews(pane) {
    const g = ui.game;
    pane.innerHTML = `<div class="section"><h3>Right now</h3>${g.activeEvents.length ? g.activeEvents.map(ev => `<div class="news-item event"><div class="h">${esc(ev.headline)} <span class="muted">· about ${ev.monthsLeft} months left</span></div><div class="d">${esc(ev.desc)}</div>${ev.real ? `<div class="real">🌍 In the real world: ${esc(ev.real)}</div>` : ''}</div>`).join('') : `<span class="muted">No shocks in progress. The economy is in ${esc(g.eco.cycle)}.</span>`}${g.rentCap('residential') < 1 ? '<div class="warn" style="font-size:13px;margin-top:6px">Rent control is in force: residential rents capped at 80% of market.</div>' : ''}</div>
      <div class="section"><h3>Headlines</h3>${g.news.map(n => `<div class="news-item ${n.kind}"><div class="h"><span class="muted">${esc(g.dateLabel(n.month))}</span> · ${esc(n.headline)}</div><div class="d">${esc(n.desc)}</div>${n.real ? `<div class="real">🌍 In the real world: ${esc(n.real)}</div>` : ''}</div>`).join('')}</div>`;
  }

  /* ---------------- reports ---------------- */
  function showYearReport(report) {
    const g = ui.game;
    if (ui.humans === 0 && ui.aiSpeed === 0) return Promise.resolve();
    const rows = report.rows.map((r, i) => `<tr><td>${i + 1}</td><td><span class="avatar" style="background:${r.player.color};width:20px;height:20px;font-size:10px">${esc(r.player.name[0])}</span> ${esc(r.player.name)}</td><td class="r">${money(r.salary + r.rent + r.dividends)}</td><td class="r bad">${money(r.tax + r.wealthTax)}</td><td class="r">${r.oop ? money(r.oop) : '–'}</td><td class="r"><b>${money(r.netWorth)}</b></td></tr>${r.note ? `<tr><td></td><td colspan="5" class="muted">${esc(r.note)}</td></tr>` : ''}`).join('');
    return modal({ icon: '🧾', title: `${report.year} in review`, text: `Income taxes are paid. Prices ${g.eco.marketIndex >= 100 ? 'up' : 'down'} to ${Math.round(g.eco.marketIndex)} (from 100 at the start). Everyone is a year older.`, html: `<div class="twrap"><table class="t"><thead><tr><th>#</th><th>Player</th><th class="r">Income</th><th class="r">Tax</th><th class="r">Medical</th><th class="r">Net worth</th></tr></thead><tbody>${rows}</tbody></table></div><canvas class="chart" id="wealthChart" width="700" height="130" style="margin-top:10px"></canvas><div class="muted" style="font-size:12px">Net worth of every player since the start.</div>`, options: [{ id: 'ok', label: 'Continue' }], onRender: box => drawWealth(box.querySelector('#wealthChart'), g) });
  }
  function showGameOver(ranking) {
    const g = ui.game; try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    const rows = ranking.map((p, i) => `<tr><td>${i === 0 && g.isActive(p) ? '🏆' : i + 1}</td><td>${esc(p.name)}</td><td class="muted">${esc(p.bgTitle)}</td><td class="r">${money(p.startNetWorth)}</td><td class="r"><b>${g.isActive(p) ? money(g.netWorth(p)) : (p.bankrupt ? 'bankrupt' : 'deceased')}</b></td></tr>`).join('');
    modal({ icon: '🏆', title: g.winner ? `${g.winner.name} wins` : 'Game over', text: g.winner ? `Final net worth ${money(g.netWorth(g.winner), false)}. Policy: ${g.policy.name}. Scenario: ${g.scenario.name}.` : 'Nobody made it.', wide: true, html: `<div class="twrap"><table class="t"><thead><tr><th>#</th><th>Player</th><th>Started as</th><th class="r">Started with</th><th class="r">Finished with</th></tr></thead><tbody>${rows}</tbody></table></div>${lessonsHtml(g)}`, options: [{ id: 'menu', label: 'New game' }, { id: 'stay', label: 'Look at the board' }], onRender: box => drawWealth(box.querySelector('#wealthChart'), g) }).then(r => { if (r === 'menu') location.reload(); else render(); });
  }
  function showGlossary() {
    modal({ icon: '📚', title: 'Words to know', html: `<div class="gloss">${D.GLOSSARY.map(([t, d]) => `<div><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}</div>`, options: [{ id: 'ok', label: 'Close' }] });
  }
  function showHelp() {
    modal({ icon: '📖', title: 'How to play', html: `<div class="howto" style="margin-bottom:14px">
      <div><span class="ic">🎲</span><div><b>Roll, land, decide.</b> Empty building: buy it with cash or a mortgage. Someone else's: pay a month of rent. Corners and special squares bring events.</div></div>
      <div><span class="ic">📅</span><div><b>One round is one month.</b> Salary in, living costs, mortgages, upkeep and property tax out. December: income tax on everything you earned.</div></div>
      <div><span class="ic">🏠</span><div><b>Build houses.</b> Each house adds 12% rent (up to 3). Own a whole colour group for +25% rent. Repair worn-out buildings or tenants leave and you get fined.</div></div>
      <div><span class="ic">🤝</span><div><b>One market.</b> Buy any empty building off-market (5% extra), list yours at any price, or make offers on anyone's.</div></div>
      <div><span class="ic">🏥</span><div><b>Stay healthy.</b> Health falls with age and stress. Without insurance a hospital stay can cost more than a house.</div></div>
      <div><span class="ic">💳</span><div><b>Do not run dry.</b> Negative cash uses an expensive credit line. When that runs out, your assets are seized.</div></div></div>`, options: [{ id: 'ok', label: 'Got it' }, { id: 'gloss', label: 'Words to know', desc: 'Net worth, equity, leverage, inflation and the rest.' }] }).then(r => { if (r === 'gloss') showGlossary(); });
  }

  renderSetup();
  window.REC = ui;
})();
