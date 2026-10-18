/* Real Estate Capital v2 — browser UI. Everything the player must do appears in one action card. */
(function () {
  'use strict';
  const D = window.GAME_DATA, { Game, fmt } = window.GameEngine, { decide } = window.GameAI;
  const $ = s => document.querySelector(s);
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const SAVE = 'rec2-save';
  const poss = n => /^(you|me)$/i.test(n) ? 'Your' : n + "'s";
  const ui = { game: null, speed: 600, explained: {}, animPos: {}, spinning: false, wheelAngle: 0, busy: false, lastMoveKey: null, selected: null, queued: false };

  /* ---------------- setup ---------------- */
  function renderSetup() {
    let saved = null; try { saved = localStorage.getItem(SAVE); } catch (e) { /* ignore */ }
    $('#app').innerHTML = `<div class="setup"><div class="logo">Real Estate Capital</div>
      <p class="tag">Monopoly, except nobody starts equal. Spin the wheel to find out who you are, then buy, build, pay rent, pay tax, and survive whatever the world throws at you.</p>
      <div class="setup-grid"><div class="card"><h2>Who is playing?</h2><div id="rows"></div><button class="btn small" id="add">+ Add player</button>
        <div class="opts"><div class="muted" style="font-size:13px">Click a token to change it.</div>
          <label>Game length <select id="rounds"><option value="16">Quick (about 25 min)</option><option value="24" selected>Normal (about 40 min)</option><option value="40">Long (an hour or more)</option></select></label>
          <label>Computer speed <select id="speed"><option value="600">Normal</option><option value="200">Fast</option><option value="0">Instant</option></select></label>
          <label>Explain things the first time they happen <input type="checkbox" id="explain" checked></label></div>
        <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary big" id="start" style="width:auto">Start game</button><button class="btn big" id="demo" style="width:auto" title="Four computer players play a quick game by themselves">Watch a demo</button>${saved ? '<button class="btn big" id="cont" style="width:auto">Continue saved game</button>' : ''}</div></div>
      <div class="card"><h2>How it works</h2><div class="howto">
        <div><span class="ic">🎡</span><div><b>Spin the wheel.</b> It deals you a life: an heir, a nurse, a graduate with debt. Different cash, salary, insurance and property.</div></div>
        <div><span class="ic">🎲</span><div><b>Then it is Monopoly.</b> Roll, buy properties, collect rent, build houses, trade. Doubles roll again.</div></div>
        <div><span class="ic">💵</span><div><b>Every lap is a year.</b> Pass Payday for your salary, minus income tax. Higher earners pay a higher rate.</div></div>
        <div><span class="ic">🎴</span><div><b>Life and World cards.</b> Accidents, layoffs, recessions, pandemics. They do not hit everyone equally.</div></div>
        <div><span class="ic">🏥</span><div><b>Hospital instead of jail.</b> Pay the bill or roll doubles. Insurance makes it cheap.</div></div>
        <div><span class="ic">🏆</span><div><b>Highest net worth wins</b> when the rounds run out. Run out of money and assets and you are out.</div></div></div></div></div></div>
      <div id="modal" class="modal" hidden><div class="mbox" id="mbox"></div></div><div class="toasts" id="toasts"></div>`;
    const rows = $('#rows');
    const addRow = (name, ai) => { const i = rows.children.length; const r = document.createElement('div'); r.className = 'prow'; r.innerHTML = `<button type="button" class="avatar tokpick" style="border-color:${D.COLORS[i]}" data-t="${i}">${D.TOKENS[i]}</button><input type="text" value="${esc(name)}" maxlength="14"><select><option value="h"${ai ? '' : ' selected'}>Human</option><option value="ai"${ai ? ' selected' : ''}>Computer</option></select><button class="btn small ghost danger">✕</button>`; r.lastElementChild.onclick = () => { if (rows.children.length > 2) { r.remove(); [...rows.children].forEach((x, k) => { x.firstElementChild.style.borderColor = D.COLORS[k]; }); } }; const tp = r.querySelector('.tokpick'); tp.onclick = () => { const n = (Number(tp.dataset.t) + 1) % D.TOKENS.length; tp.dataset.t = n; tp.textContent = D.TOKENS[n]; }; rows.appendChild(r); };
    addRow('Player 1', false); addRow('Dana', true); addRow('Marcus', true);
    $('#add').onclick = () => { if (rows.children.length < 8) addRow(['Priya', 'Leo', 'Sofia', 'Omar', 'Mia'][rows.children.length - 3] || 'Player', true); };
    $('#start').onclick = () => {
      const used = new Set();
      const players = [...rows.children].map(r => { let t = D.TOKENS[Number(r.querySelector('.tokpick').dataset.t)]; if (used.has(t)) t = D.TOKENS.find(x => !used.has(x)); used.add(t); return { name: r.querySelector('input').value.trim() || 'Player', isAI: r.querySelector('select').value === 'ai', token: t }; });
      ui.speed = Number($('#speed').value);
      startGame(new Game({ players, rounds: Number($('#rounds').value), explain: $('#explain').checked }));
    };
    $('#demo').onclick = () => { ui.speed = 250; startGame(new Game({ players: [['Heir', '🎩'], ['Nurse', '🚗'], ['Graduate', '🐕'], ['Builder', '🚢']].map(([n, t]) => ({ name: n, isAI: true, token: t })), rounds: 16, explain: false })); };
    if (saved) $('#cont').onclick = () => { try { ui.speed = Number($('#speed').value); const data = JSON.parse(saved); ui.explained = data.explained || {}; startGame(Game.fromJSON(data.state)); } catch (e) { console.error(e); toast('Saved game could not be loaded', 'bad'); } };
  }

  function startGame(game) {
    ui.game = game; ui.animPos = {}; ui.spinning = false; ui.selected = null; ui.shownOver = false;
    game.onChange(() => { render(); save(); });
    buildGame(); render(); drive();
  }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify({ state: ui.game.state, explained: ui.explained })); } catch (e) { /* ignore */ } }
  function toast(msg, kind) { const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3600); }

  /* ---------------- driving: computer turns, passive notices, animation ---------------- */
  function actorOf(q) { if (!q) return null; return ui.game.player(q.type === 'trade' ? q.toId : q.playerId); }
  function seen(pid, key) { return !ui.game.state.cfg.explain || !!(ui.explained[pid] && ui.explained[pid][key]); }
  function markSeen(pid, key) { if (!key) return; (ui.explained[pid] = ui.explained[pid] || {})[key] = true; }
  async function drive() {
    if (ui.busy) { ui.driveAgain = true; return; } ui.busy = true;
    try {
      while (true) {
        const g = ui.game, q = g.pending; if (!q || g.state.over) break;
        const p = actorOf(q);
        // token animation after a move
        const lm = g.state.lastMove; const key = lm ? `${lm.playerId}:${lm.from}:${lm.to}:${g.state.log.length}` : null;
        if (lm && key !== ui.lastMoveKey) { ui.lastMoveKey = key; if (ui.speed > 0 || !g.player(lm.playerId).isAI) await animateMove(lm); continue; }
        if (p.isAI) {
          if (q.type === 'spin') { await spinWheel(p); g.dispatch({ type: 'spin', playerId: p.id }); continue; }
          if (ui.speed > 0) await sleep(q.type === 'notice' || q.type === 'card' ? ui.speed : ui.speed / 2);
          const a = decide(g, q); if (!a) break;
          const r = g.dispatch(a); if (!r.ok) { console.error('AI action failed', a, r.msg); break; }
          continue;
        }
        // human: auto-dismiss passive notices once explained
        if (q.type === 'notice' && ((q.passive && seen(p.id, q.explain)) || q.trivial)) { toast(`${p.name}: ${q.text}`, q.passive ? 'good' : ''); g.dispatch({ type: 'ack', playerId: p.id }); continue; }
        break;
      }
    } finally { ui.busy = false; if (ui.driveAgain) { ui.driveAgain = false; drive(); } }
  }
  function act(a) { const g = ui.game; const q = g.pending; const r = g.dispatch(a); if (!r.ok) { toast(r.msg, 'bad'); return; } if (q && q.explain && a.playerId !== undefined) markSeen(a.playerId, q.explain); if (r.msg && r.msg.startsWith('explain:')) { const k = r.msg.slice(8); if (!seen(a.playerId, k)) { markSeen(a.playerId, k); showExplain(k); } } save(); render(); drive(); }
  async function tumble() {
    const el = document.querySelector('.centre .dice'); if (!el) return;
    const ms = ui.speed === 0 ? 0 : 55; if (!ms) return;
    for (let i = 0; i < 9; i++) { el.textContent = DICE[Math.floor(Math.random() * 6)] + DICE[Math.floor(Math.random() * 6)]; await sleep(ms); }
    const d = ui.game.state.dice; if (d) el.textContent = DICE[d[0] - 1] + DICE[d[1] - 1];
  }
  async function animateMove(lm) {
    await tumble();
    const steps = (lm.to - lm.from + 40) % 40; if (!steps || steps > 12) { renderBoard(); return; }
    let pos = lm.from; const ms = ui.speed === 0 ? 60 : 110;
    for (let i = 0; i < steps; i++) { pos = (pos + 1) % 40; ui.animPos[lm.playerId] = pos; renderBoard(); await sleep(ms); }
    delete ui.animPos[lm.playerId]; renderBoard();
  }

  /* ---------------- the wheel ---------------- */
  function drawWheel(cv, angle, highlight) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 14;
    ctx.clearRect(0, 0, W, H);
    const n = D.BACKGROUNDS.length, seg = Math.PI * 2 / n;
    const cols = ['#fef200', '#aae0fa', '#1fb25a', '#ed1b24', '#d93a96', '#f7941d', '#0072bb', '#955436'];
    for (let i = 0; i < n; i++) {
      const a0 = angle + i * seg, a1 = a0 + seg;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath();
      ctx.fillStyle = cols[i % cols.length]; ctx.globalAlpha = highlight === i ? 1 : 0.85; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); const mid = a0 + seg / 2, flip = Math.cos(mid) < 0; ctx.rotate(flip ? mid + Math.PI : mid); ctx.textAlign = flip ? 'left' : 'right'; ctx.fillStyle = [3, 6, 7].includes(i) ? '#fff' : '#111'; ctx.font = `600 ${Math.round(R / 9)}px Oswald, sans-serif`; ctx.fillText(D.BACKGROUNDS[i].icon + ' ' + D.BACKGROUNDS[i].short, flip ? -R + 12 : R - 12, 5); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.12, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#333'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + R + 12, cy); ctx.lineTo(cx + R - 14, cy - 12); ctx.lineTo(cx + R - 14, cy + 12); ctx.closePath(); ctx.fillStyle = '#1b2430'; ctx.fill();
  }
  function spinWheel(p) {
    return new Promise(resolve => {
      const g = ui.game; const target = D.BACKGROUNDS.findIndex(b => b.id === g.state.wheel[p.id]);
      const seg = Math.PI * 2 / D.BACKGROUNDS.length;
      // pointer is at angle 0 (right). Segment i covers [angle + i*seg, angle + (i+1)*seg]. We want target centre at 0.
      const finalAngle = -(target * seg + seg / 2) + Math.PI * 2 * (5 + Math.floor(Math.random() * 2));
      const start = ui.wheelAngle % (Math.PI * 2), dur = ui.speed === 0 && p.isAI ? 400 : 2800, t0 = performance.now();
      ui.spinning = true;
      const frame = now => {
        const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
        ui.wheelAngle = start + (finalAngle - start) * e;
        const cv = $('#wheel'); if (cv) drawWheel(cv, ui.wheelAngle, t >= 1 ? target : -1);
        if (t < 1) requestAnimationFrame(frame); else { ui.spinning = false; setTimeout(resolve, 500); }
      };
      requestAnimationFrame(frame);
    });
  }

  /* ---------------- layout ---------------- */
  function cellPos(i) { if (i <= 10) return [11, 11 - i]; if (i <= 20) return [11 - (i - 10), 1]; if (i <= 30) return [1, 1 + (i - 20)]; return [1 + (i - 30), 11]; }
  function buildGame() {
    $('#app').innerHTML = `<div class="game"><div class="top" id="top"></div><div class="main"><div class="board" id="board"></div><div class="rail" id="rail"></div></div></div><div id="modal" class="modal" hidden><div class="mbox" id="mbox"></div></div><div class="toasts" id="toasts"></div>`;
    const board = $('#board');
    D.BOARD.forEach((sq, i) => {
      const c = document.createElement('div'); c.className = 'cell' + (sq.kind === 'property' ? '' : ' sp') + (i % 10 === 0 ? ' corner' : ''); c.dataset.i = i;
      const [r, col] = cellPos(i); c.style.gridRow = r; c.style.gridColumn = col;
      c.onclick = () => { if (sq.kind === 'property') showDeed(i); };
      board.appendChild(c);
    });
    const centre = document.createElement('div'); centre.className = 'centre'; centre.id = 'centre'; board.appendChild(centre);
  }
  function render() { if (ui.queued) return; ui.queued = true; requestAnimationFrame(() => { ui.queued = false; if (!ui.game || !$('#board')) return; try { renderTop(); renderBoard(); renderCentre(); renderRail(); } catch (e) { console.error(e); } }); }

  function renderTop() {
    const g = ui.game, st = g.state;
    $('#top').innerHTML = `<div><div class="title">Real Estate Capital</div><div class="sub">Round ${Math.min(st.round, st.cfg.rounds)} of ${st.cfg.rounds}${st.priceMult !== 1 ? ` · prices ${Math.round(st.priceMult * 100)}%` : ''}</div></div>
      <div>${st.effects.map(e => `<span class="chip warn" title="${e.rounds} rounds left">${esc(e.title)} · ${e.rounds}</span>`).join(' ')}</div><span class="spacer"></span>
      <button class="btn small" id="helpBtn">How to play</button><button class="btn small" id="menuBtn">Menu</button>`;
    $('#helpBtn').onclick = showHelp;
    $('#menuBtn').onclick = () => modal({ title: 'Leave the game?', text: 'It is saved in this browser. Continue from the menu later.', options: [{ id: 'yes', label: 'Save and go to menu' }, { id: 'no', label: 'Keep playing' }] }).then(r => { if (r === 'yes') { save(); location.reload(); } });
  }
  function renderBoard() {
    const g = ui.game, st = g.state;
    const posOf = p => (ui.animPos[p.id] !== undefined ? ui.animPos[p.id] : p.position);
    const cur = g.current();
    document.querySelectorAll('.cell').forEach(c => {
      const i = Number(c.dataset.i), sq = D.BOARD[i];
      const toks = st.players.filter(p => !p.bankrupt && p.bg && posOf(p) === i).map(p => `<span class="tok" style="border-color:${p.color}" title="${esc(p.name)}">${p.token}</span>`).join('');
      c.classList.toggle('here', !!(cur && cur.bg && posOf(cur) === i && !st.over));
      c.className = c.className.replace(/ k-\w+/g, '') + ' k-' + sq.kind;
      if (sq.kind !== 'property') {
        const subs = { go: 'Collect salary as you pass', hospital: 'Just visiting', dayoff: 'Nothing happens', accident: 'Go to Hospital', tax: 'Pay 1% of what you own', wealth: '2% above $1M', life: 'Chance', world: 'Everyone' };
        const icon = sq.kind === 'life' ? '?' : sq.kind === 'go' ? '<span class="arrow">➜</span>' : sq.icon;
        c.innerHTML = `<div class="body"><div class="ic">${icon}</div><div class="name">${esc(sq.name)}</div>${subs[sq.kind] && i % 10 === 0 ? `<div class="sub">${esc(subs[sq.kind])}</div>` : ''}</div><div class="toks">${toks}</div>`; return;
      }
      const pr = st.props[i], grp = D.GROUPS[sq.group], owner = pr.owner === null ? null : st.players[pr.owner];
      const houses = pr.houses === 5 ? '🏨' : '🏠'.repeat(pr.houses);
      c.innerHTML = `<div class="stripe ${grp.dark ? 'dark' : ''}" style="background:${grp.color}">${sq.group === 'transport' ? '🚆' : houses}</div><div class="body"><div class="name">${esc(sq.name)}</div><div class="val">${fmt(g.price(i), true)}</div></div><div class="toks">${toks}</div><div class="own" style="background:${owner ? owner.color : 'transparent'}"></div>${pr.mortgaged ? '<div class="mort"></div>' : ''}`;
      c.title = `${sq.name} — ${owner ? 'owned by ' + owner.name : 'for sale'}${pr.mortgaged ? ' (mortgaged)' : ''}`;
    });
  }
  function renderCentre() {
    const g = ui.game, st = g.state, q = g.pending, c = $('#centre');
    c.classList.toggle('spinmode', !!(q && q.type === 'spin'));
    if (q && q.type === 'spin') {
      const p = g.player(q.playerId);
      c.innerHTML = `<h2>${esc(p.name)}, spin the wheel</h2><canvas id="wheel" class="wheel" width="420" height="420"></canvas><div class="ticker">Where you start in life is not up to you.</div>`;
      drawWheel($('#wheel'), ui.wheelAngle, -1); return;
    }
    const cur = g.current();
    const last = st.log.slice(-4).reverse();
    c.innerHTML = `<div class="ribbon">Real Estate Capital</div><div class="deck life">Life</div><div class="deck world">World</div><div class="note"><div class="dice">${st.dice ? DICE[st.dice[0] - 1] + DICE[st.dice[1] - 1] : '🎲'}</div><h2>${st.over ? 'Game over' : esc(poss(cur.name)) + ' turn'}</h2>
      <div class="fx">${st.effects.map(e => `<span class="chip warn">${esc(e.title)}</span>`).join('')}</div>
      <div class="ticker">${last.map(e => `<div>${esc(e.text)}</div>`).join('')}</div></div>`;
  }

  /* ---------------- rail: action card, me, players ---------------- */
  function renderRail() {
    const g = ui.game, st = g.state, q = g.pending, rail = $('#rail');
    rail.innerHTML = '';
    rail.appendChild(actionCard(q));
    const p = actorOf(q) || g.current();
    if (p && p.bg) rail.appendChild(meCard(p, q));
    rail.appendChild(playersCard());
  }
  function explainBox(pid, key) {
    if (!key || seen(pid, key) || !D.EXPLAIN[key]) return '';
    return `<div class="explain"><b>ℹ️ ${esc(D.EXPLAIN[key][0])}</b>${esc(D.EXPLAIN[key][1])}</div>`;
  }
  function who(p, label) { return `<div class="who"><span class="avatar" style="border-color:${p.color}">${p.token}</span><div><b>${esc(p.name)}</b><div class="muted">${esc(label || '')}</div></div></div>`; }
  function btn(label, fn, o) { const b = document.createElement('button'); b.className = 'btn ' + ((o && o.cls) || ''); b.textContent = label; b.disabled = !!(o && o.disabled); b.title = (o && o.title) || ''; b.onclick = fn; return b; }
  function actionCard(q) {
    const g = ui.game, st = g.state;
    const card = document.createElement('div'); card.className = 'act';
    if (!q || st.over) { if (st.over && !ui.shownOver) { ui.shownOver = true; setTimeout(showGameOver, 600); } card.innerHTML = `<h2>Game over</h2><div class="text">${st.winner !== null ? esc(g.player(st.winner).name) + ' has the highest net worth.' : ''}</div>`; card.appendChild(btn('See the results', showGameOver, { cls: 'primary big' })); return card; }
    const p = actorOf(q);
    const bg = p.bg ? D.BACKGROUNDS.find(b => b.id === p.bg) : null;
    const label = bg ? `${bg.icon} ${bg.title}` : 'about to find out who they are';
    if (p.isAI) { card.innerHTML = who(p, label) + `<div class="text muted">${esc(p.name)} is ${q.type === 'spin' ? 'spinning the wheel' : 'playing'}…</div>`; return card; }
    card.classList.add('mine');
    const btns = document.createElement('div'); btns.className = 'btns';
    const pid = p.id;
    switch (q.type) {
      case 'spin':
        card.innerHTML = who(p, label) + `<h2>Spin the wheel</h2><div class="text">Nobody picks where they start. Spin to find out.</div>${explainBox(pid, 'spin')}`;
        btns.appendChild(btn(ui.spinning ? 'Spinning…' : '🎡 Spin', async () => { if (ui.spinning) return; markSeen(pid, 'spin'); render(); await spinWheel(p); act({ type: 'spin', playerId: pid }); }, { cls: 'primary big', disabled: ui.spinning }));
        break;
      case 'notice': case 'card': {
        if (q.type === 'card') { card.classList.add('t-card', 'deck-' + q.deck); }
        card.innerHTML = who(p, label) + (q.type === 'card' ? `<div class="deckhead">${q.deck === 'life' ? '? Life card' : '🌍 World card · everyone'}</div>` : '') + `<h2>${esc(q.title.replace(/^[^\w]+/, ''))}</h2><div class="text">${esc(q.text)}</div>${q.lines && q.lines.length ? `<div class="lines">${q.lines.map(l => `<div><span>${esc(l)}</span></div>`).join('')}</div>` : ''}${q.real ? `<div class="real">🌍 In the real world: ${esc(q.real)}</div>` : ''}${explainBox(pid, q.explain)}`;
        btns.appendChild(btn(q.type === 'card' ? 'OK' : 'Continue', () => act({ type: 'ack', playerId: pid }), { cls: 'primary big' }));
        break;
      }
      case 'buy': {
        const i = q.square;
        card.innerHTML = who(p, label) + `<h2>${esc(g.sq(i).name)} is for sale</h2>` + deedHtml(i) + explainBox(pid, 'buy');
        btns.appendChild(btn(q.needsLoan ? `Buy for ${fmt(q.price)} (borrow ${fmt(Math.ceil(q.needsLoan / D.COSTS.loanStep) * D.COSTS.loanStep)})` : `Buy for ${fmt(q.price)}`, () => act({ type: 'buy', playerId: pid }), { cls: 'primary big' }));
        btns.appendChild(btn('Pass (it goes to auction)', () => act({ type: 'pass', playerId: pid }), { cls: 'big' }));
        card.insertAdjacentHTML('beforeend', `<div class="hint">You have ${fmt(p.cash)}${p.credit - p.loan > 0 ? ` and can borrow ${fmt(p.credit - p.loan)}` : ''}.</div>`);
        break;
      }
      case 'bid': {
        const i = q.square, maxBid = Math.floor((p.cash + Math.max(0, p.credit - p.loan)) / D.COSTS.auctionStep) * D.COSTS.auctionStep;
        card.innerHTML = who(p, label) + `<h2>Auction: ${esc(g.sq(i).name)}</h2><div class="text">List price ${fmt(g.price(i))}. Everyone bids once, in secret. Highest bid wins.</div>` + deedHtml(i) + explainBox(pid, 'auction') + `<div class="amt"><label>Your bid <input type="number" id="bidAmt" min="0" max="${maxBid}" step="${D.COSTS.auctionStep}" value="${Math.min(maxBid, Math.round(g.price(i) * 0.8 / D.COSTS.auctionStep) * D.COSTS.auctionStep)}" style="width:150px"></label><span class="muted" style="font-size:12px">up to ${fmt(maxBid)}</span></div>`;
        btns.appendChild(btn('Place bid', () => act({ type: 'bid', playerId: pid, amount: Number(card.querySelector('#bidAmt').value) || 0 }), { cls: 'primary big', disabled: maxBid < D.COSTS.auctionStep }));
        btns.appendChild(btn('No bid', () => act({ type: 'bid', playerId: pid, amount: 0 }), { cls: 'big' }));
        break;
      }
      case 'turn':
        card.innerHTML = who(p, label) + `<h2>${q.again ? 'Doubles! Roll again' : 'Your turn'}</h2><div class="text muted">Build, mortgage or trade below if you want. Then roll.</div>`;
        btns.appendChild(btn('🎲 Roll the dice', () => act({ type: 'roll', playerId: pid }), { cls: 'primary big' }));
        break;
      case 'hospital': {
        const bill = p.insured ? D.COSTS.hospitalBillInsured : D.COSTS.hospitalBill;
        card.innerHTML = who(p, label) + `<h2>In Hospital (turn ${q.turn} of 3)</h2><div class="text">Pay the bill and move on, or roll for doubles.${q.turn >= 3 ? ' This is your last turn here: if you do not roll doubles, you pay anyway.' : ''}</div>${explainBox(pid, 'hospital')}`;
        btns.appendChild(btn(`Pay ${fmt(bill)} and leave${p.insured ? ' (insured)' : ''}`, () => act({ type: 'hospitalPay', playerId: pid }), { cls: 'primary big' }));
        btns.appendChild(btn('🎲 Try for doubles', () => act({ type: 'roll', playerId: pid }), { cls: 'big' }));
        break;
      }
      case 'endTurn':
        card.innerHTML = who(p, label) + `<h2>Anything else?</h2><div class="text muted">Build, mortgage, pay off or trade below. Then end your turn.</div>`;
        btns.appendChild(btn('End turn ➜', () => act({ type: 'endTurn', playerId: pid }), { cls: 'primary big' }));
        break;
      case 'debt': {
        const canRaise = g.liquid(p) >= 0;
        card.innerHTML = who(p, label) + `<h2>You are ${fmt(Math.max(0, -p.cash))} short</h2><div class="text">${q.creditorId !== null ? `You owe ${esc(g.player(q.creditorId).name)}.` : 'You owe the bank.'} Borrow from the bank, sell houses or mortgage properties below to raise the money.</div>${explainBox(pid, 'debt')}`;
        if (p.cash >= 0) btns.appendChild(btn('Pay and continue', () => act({ type: 'payDebt', playerId: pid }), { cls: 'primary big' }));
        else if (!canRaise) btns.appendChild(btn('Declare bankruptcy', () => act({ type: 'bankrupt', playerId: pid }), { cls: 'big danger' }));
        else {
          const need = -p.cash, credit = p.credit - p.loan;
          if (credit >= D.COSTS.loanStep) { const amt = Math.min(credit, Math.ceil(need / D.COSTS.loanStep) * D.COSTS.loanStep); btns.appendChild(btn(`Borrow ${fmt(amt)} from the bank`, () => act({ type: 'loan', playerId: pid, amount: amt }), { cls: 'primary big' })); }
          const withHouses = g.propsOf(pid).filter(i => g.prop(i).houses > 0).sort((a, b) => g.houseCost(b) - g.houseCost(a));
          if (withHouses.length) btns.appendChild(btn(`Sell a house on ${g.sq(withHouses[0]).name} (+${fmt(g.houseCost(withHouses[0]) / 2)})`, () => act({ type: 'sellHouse', playerId: pid, square: withHouses[0] }), { cls: 'big' }));
          const canMort = g.propsOf(pid).filter(i => !g.prop(i).mortgaged && g.prop(i).houses === 0 && !(g.sq(i).group !== 'transport' && g.groupSquares(g.sq(i).group).some(j => g.prop(j).owner === pid && g.prop(j).houses > 0))).sort((a, b) => g.price(a) - g.price(b));
          if (canMort.length) btns.appendChild(btn(`Mortgage ${g.sq(canMort[0]).name} (+${fmt(g.price(canMort[0]) / 2)})`, () => act({ type: 'mortgage', playerId: pid, square: canMort[0] }), { cls: 'big' }));
          card.insertAdjacentHTML('beforeend', `<div class="hint">Or use the buttons on your properties below. You can raise up to ${fmt(g.liquid(p) - p.cash)}.</div>`);
        }
        break;
      }
      case 'trade': {
        const from = g.player(q.fromId);
        card.innerHTML = who(p, label) + `<h2>Trade offer from ${esc(from.name)}</h2><div class="text">${esc(g.describeTrade(q))}.</div>${explainBox(pid, 'trade')}`;
        btns.appendChild(btn('Accept', () => act({ type: 'acceptTrade', playerId: pid }), { cls: 'primary big' }));
        btns.appendChild(btn('Decline', () => act({ type: 'declineTrade', playerId: pid }), { cls: 'big' }));
        break;
      }
    }
    card.appendChild(btns);
    return card;
  }
  function deedHtml(i) {
    const g = ui.game, sq = g.sq(i), grp = D.GROUPS[sq.group], pr = g.prop(i);
    const owner = pr.owner === null ? null : g.player(pr.owner);
    let rows;
    if (sq.group === 'transport') rows = sq.rents.map((r, k) => `<div><span>Rent with ${k + 1} transport${k ? 's' : ''}</span><b>${fmt(r * g.state.priceMult)}</b></div>`).join('');
    else rows = `<div><span>Rent</span><b>${fmt(sq.rents[0] * g.state.priceMult)}</b></div><div><span>With the whole colour group</span><b>${fmt(sq.rents[0] * 2 * g.state.priceMult)}</b></div>` + [1, 2, 3, 4].map(k => `<div><span>With ${k} house${k > 1 ? 's' : ''}</span><b>${fmt(sq.rents[k] * g.state.priceMult)}</b></div>`).join('') + `<div><span>With a hotel</span><b>${fmt(sq.rents[5] * g.state.priceMult)}</b></div><div><span>Each house costs</span><b>${fmt(g.houseCost(i))}</b></div>`;
    return `<div class="deed"><div class="deed-top ${grp.dark ? 'dark' : ''}" style="background:${grp.color}"><span>Title deed · ${esc(grp.name)}</span><b>${esc(sq.name)}</b><span>${owner ? 'Owned by ' + esc(owner.name) + (pr.mortgaged ? ' · mortgaged' : '') : 'Price ' + fmt(g.price(i))}</span></div><div class="deed-body">${rows}<div><span>Mortgage value</span><b>${fmt(g.price(i) / 2)}</b></div></div></div>`;
  }
  function meCard(p, q) {
    const g = ui.game, st = g.state;
    const manage = q && !p.isAI && (q.type === 'turn' || q.type === 'endTurn' || q.type === 'debt') && q.playerId === p.id;
    const debtOnly = q && q.type === 'debt';
    const el = document.createElement('div'); el.className = 'me';
    const mine = g.propsOf(p.id);
    el.innerHTML = `<div class="nums"><div><div class="l">Cash</div><div class="v ${p.cash < 0 ? 'bad' : ''}">${fmt(p.cash, true)}</div></div><div><div class="l">Net worth</div><div class="v">${fmt(g.netWorth(p), true)}</div></div><div><div class="l">Salary</div><div class="v">${fmt(p.salary, true)}</div></div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:13px">${p.insured ? '<span class="chip good">Insured</span>' : '<span class="chip bad">No health insurance</span>'}${p.debt ? `<span class="chip warn">Student loan ${fmt(p.debt, true)}</span>` : ''}${p.loan ? `<span class="chip warn">Bank loan ${fmt(p.loan, true)}</span>` : ''}${p.laidOff ? '<span class="chip bad">Laid off</span>' : ''}<span class="muted">Credit left ${fmt(Math.max(0, p.credit - p.loan), true)} · Laps ${p.laps}</span></div>
      <div class="section"><h3>${esc(poss(p.name))} properties</h3><div class="plist" id="plist"></div></div><div id="mactions" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div>`;
    const list = el.querySelector('#plist');
    if (!mine.length) list.innerHTML = '<span class="muted" style="font-size:13px">None yet.</span>';
    mine.sort((a, b) => a - b).forEach(i => {
      const sq = g.sq(i), pr = g.prop(i), row = document.createElement('div'); row.className = 'pitem' + (pr.mortgaged ? ' mort' : '');
      row.innerHTML = `<span class="sw" style="background:${D.GROUPS[sq.group].color}"></span><span class="n"><a href="#" style="color:inherit;text-decoration:none">${esc(sq.name)}</a> ${pr.houses === 5 ? '🏨' : '🏠'.repeat(pr.houses)}${pr.mortgaged ? ' <span class="muted">(mortgaged)</span>' : ''}</span>`;
      row.querySelector('a').onclick = e => { e.preventDefault(); showDeed(i); };
      if (manage) {
        const acts = document.createElement('span'); acts.className = 'acts';
        if (!debtOnly && g.canBuild(p.id, i)) acts.appendChild(btn(`${pr.houses === 4 ? 'Hotel' : 'House'} ${fmt(g.houseCost(i), true)}`, () => act({ type: 'build', playerId: p.id, square: i }), { cls: 'small', disabled: p.cash < g.houseCost(i) }));
        if (pr.houses > 0) acts.appendChild(btn(`Sell house +${fmt(g.houseCost(i) / 2, true)}`, () => act({ type: 'sellHouse', playerId: p.id, square: i }), { cls: 'small' }));
        if (!pr.mortgaged && pr.houses === 0) acts.appendChild(btn(`Mortgage +${fmt(g.price(i) / 2, true)}`, () => act({ type: 'mortgage', playerId: p.id, square: i }), { cls: 'small' }));
        if (pr.mortgaged && !debtOnly) acts.appendChild(btn(`Pay off ${fmt(g.price(i) * 0.55, true)}`, () => act({ type: 'unmortgage', playerId: p.id, square: i }), { cls: 'small', disabled: p.cash < g.price(i) * 0.55 }));
        row.appendChild(acts);
      }
      list.appendChild(row);
    });
    if (manage) {
      const ma = el.querySelector('#mactions');
      if (p.credit - p.loan >= D.COSTS.loanStep) ma.appendChild(btn(`Borrow from the bank`, () => loanModal(p), { cls: 'small' }));
      if (p.loan > 0 && !debtOnly && p.cash >= D.COSTS.loanStep) ma.appendChild(btn(`Repay loan`, () => act({ type: 'repayLoan', playerId: p.id, amount: Math.min(p.loan, Math.floor(p.cash / D.COSTS.loanStep) * D.COSTS.loanStep) }), { cls: 'small' }));
    }
    if (manage && !debtOnly) {
      const ma = el.querySelector('#mactions');
      ma.appendChild(btn(p.insured ? 'Cancel health insurance' : `Get health insurance (${fmt(D.COSTS.premium, true)}/year)`, () => act({ type: 'insurance', playerId: p.id, on: !p.insured }), { cls: 'small' }));
      if (g.active().length > 1) ma.appendChild(btn('Propose a trade', () => tradeModal(p), { cls: 'small' }));
    }
    return el;
  }
  function playersCard() {
    const g = ui.game, st = g.state, cur = g.current();
    const el = document.createElement('div'); el.className = 'players';
    el.innerHTML = st.players.map(p => { const bg = p.bg ? D.BACKGROUNDS.find(b => b.id === p.bg) : null; return `<div class="prow2 ${cur && cur.id === p.id && !st.over ? 'turn' : ''} ${p.bankrupt ? 'out' : ''}"><span class="avatar" style="border-color:${p.color}">${p.token}</span><div class="n"><b>${esc(p.name)}${p.isAI ? ' <span>(computer)</span>' : ''}</b><span>${bg ? bg.icon + ' ' + esc(bg.title) : '?'} · ${g.propsOf(p.id).length} propert${g.propsOf(p.id).length === 1 ? 'y' : 'ies'}${p.hospital ? ' · in Hospital' : ''}</span></div><span class="nw">${p.bankrupt ? '<span class="bad">Bankrupt</span>' : fmt(g.netWorth(p), true)}</span></div>`; }).join('');
    return el;
  }

  /* ---------------- modals ---------------- */
  let chain = Promise.resolve();
  function modal(spec) {
    const run = () => new Promise(resolve => {
      const box = $('#mbox'); $('#modal').hidden = false; box.classList.toggle('wide', !!spec.wide);
      box.innerHTML = `<h2>${esc(spec.title || '')}</h2>${spec.text ? `<div class="text">${esc(spec.text)}</div>` : ''}${spec.html || ''}<div class="opts2">${(spec.options || [{ id: 'ok', label: 'OK' }]).map(o => `<button class="opt" data-id="${esc(o.id)}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}${o.desc ? `<span class="desc">${esc(o.desc)}</span>` : ''}</button>`).join('')}</div>`;
      if (spec.onRender) { try { spec.onRender(box); } catch (e) { console.error(e); } }
      box.querySelectorAll('.opt').forEach(b => { b.onclick = () => { $('#modal').hidden = true; resolve(b.dataset.id); }; });
    });
    const p = chain.then(run, run); chain = p.catch(() => {}); return p;
  }
  function loanModal(p) {
    const g = ui.game, max = p.credit - p.loan;
    modal({ title: 'Borrow from the bank', text: `The bank will lend you up to ${fmt(max)} more, at 10% interest a year, paid at every Payday.`, html: `<div class="amt"><label>Amount <input type="number" id="loanAmt" min="${D.COSTS.loanStep}" max="${max}" step="${D.COSTS.loanStep}" value="${Math.min(max, 50000)}" style="width:150px"></label></div>`, options: [{ id: 'ok', label: 'Borrow' }, { id: 'cancel', label: 'Cancel' }], onRender: box => { box.querySelector('[data-id=ok]').onclick = () => { const amt = Number(box.querySelector('#loanAmt').value) || 0; $('#modal').hidden = true; act({ type: 'loan', playerId: p.id, amount: amt }); }; } });
  }
  function showDeed(i) { const g = ui.game; ui.selected = i; modal({ title: '', html: deedHtml(i), options: [{ id: 'ok', label: 'Close' }] }); }
  function showExplain(key) { const e = D.EXPLAIN[key]; modal({ title: e[0], text: e[1], options: [{ id: 'ok', label: 'Got it' }] }); }
  function showHelp() {
    modal({ title: 'How to play', html: `<div class="howto">
      <div><span class="ic">🎲</span><div><b>Roll and move.</b> Land on a property nobody owns and you can buy it. Land on someone else's and you pay rent. Doubles let you roll again; three doubles in a row sends you to Hospital.</div></div>
      <div><span class="ic">💵</span><div><b>Pass Payday for a year's salary</b> minus income tax (10% to 40%, higher earners pay more) and your health insurance if you have it.</div></div>
      <div><span class="ic">🏠</span><div><b>Own a whole colour group</b> and rents there double. Then build houses (up to 4) and a hotel. Each one multiplies the rent.</div></div>
      <div><span class="ic">🏦</span><div><b>Short of cash?</b> Sell houses for half price or mortgage a property for half its price (pay 55% to get it back). No assets left means bankruptcy.</div></div>
      <div><span class="ic">🔨</span><div><b>Pass on a property and it goes to auction.</b> Everyone bids once in secret; the highest bid wins, even below list price.</div></div>
      <div><span class="ic">🏛️</span><div><b>Bank loans.</b> Borrow up to your credit limit at 10% a year, paid at Payday. Your limit depends on who you are.</div></div>
      <div><span class="ic">🤝</span><div><b>Trade.</b> On your turn, propose a swap of properties and cash to any player. Computer players will propose trades too.</div></div>
      <div><span class="ic">🧾</span><div><b>Taxes.</b> Property Tax: 1% of what you own. Wealth Tax: 2% of net worth, only above $1,000,000.</div></div>
      <div><span class="ic">🎴</span><div><b>Life cards</b> happen to you. <b>World cards</b> happen to everyone. Each tells you what it would mean in the real world.</div></div>
      <div><span class="ic">🏆</span><div><b>Win</b> by having the highest net worth (cash plus property) when the last round ends.</div></div></div>`, options: [{ id: 'ok', label: 'Close' }], wide: true });
  }
  function tradeModal(p) {
    const g = ui.game; const others = g.active().filter(x => x.id !== p.id);
    const give = g.propsOf(p.id).filter(i => g.prop(i).houses === 0);
    const html = `<div class="trade"><div class="side"><b>You give</b><label>Cash <input type="number" id="tGiveCash" value="0" min="0" max="${p.cash}" step="1000" style="width:120px"></label>${give.map(i => `<label><input type="checkbox" data-give="${i}"> ${esc(g.sq(i).name)}</label>`).join('') || '<span class="muted">No properties to give</span>'}</div>
      <div class="side"><b>You get from</b> <select id="tTo">${others.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select><label>Cash <input type="number" id="tGetCash" value="0" min="0" step="1000" style="width:120px"></label><div id="tGetList"></div></div></div>`;
    modal({ title: 'Propose a trade', html, options: [{ id: 'send', label: 'Send offer' }, { id: 'cancel', label: 'Cancel' }], onRender: box => {
      const sel = box.querySelector('#tTo'); const list = box.querySelector('#tGetList');
      const fill = () => { const to = g.player(Number(sel.value)); const ps = g.propsOf(to.id).filter(i => g.prop(i).houses === 0); list.innerHTML = ps.map(i => `<label><input type="checkbox" data-get="${i}"> ${esc(g.sq(i).name)}${g.prop(i).mortgaged ? ' (mortgaged)' : ''}</label>`).join('') || '<span class="muted">They have nothing tradable</span>'; };
      sel.onchange = fill; fill();
      box.querySelector('[data-id=send]').onclick = () => { const to = Number(sel.value); const a = { type: 'offerTrade', playerId: p.id, toId: to, give: { cash: Number(box.querySelector('#tGiveCash').value) || 0, props: [...box.querySelectorAll('[data-give]:checked')].map(x => Number(x.dataset.give)) }, get: { cash: Number(box.querySelector('#tGetCash').value) || 0, props: [...box.querySelectorAll('[data-get]:checked')].map(x => Number(x.dataset.get)) } }; $('#modal').hidden = true; act(a); };
    } });
  }
  function showGameOver() {
    const g = ui.game, st = g.state, rank = g.ranking();
    const src = rank.map(p => ({ p, wages: p.stats.wages, rent: p.stats.rentGot - p.stats.rentPaid, tax: p.stats.tax, medical: p.stats.medical }));
    const maxV = Math.max(1, ...src.flatMap(x => [x.wages, Math.abs(x.rent)]));
    const bar = (v, col) => `<div class="hb"><span style="width:${Math.round(Math.abs(v) / maxV * 100)}%;background:${col}"></span><em>${v < 0 ? '-' : ''}${fmt(Math.abs(v), true)}</em></div>`;
    const facts = [];
    const richestStart = rank.slice().sort((a, b) => b.startNW - a.startNW)[0];
    facts.push(richestStart.id === rank[0].id ? `${richestStart.name} started richest and finished richest.` : `${richestStart.name} started richest but ${rank[0].name} finished first.`);
    const gap0 = Math.max(...rank.map(p => p.startNW)) - Math.min(...rank.map(p => p.startNW)), gap1 = g.netWorth(rank[0]) - g.netWorth(rank[rank.length - 1]);
    facts.push(`The gap between richest and poorest was ${fmt(gap0, true)} at the start and ${fmt(gap1, true)} at the end.`);
    const owners = src.filter(x => x.rent > x.wages); if (owners.length) facts.push(`${owners.map(x => x.p.name).join(', ')} made more from rent than from working.`);
    src.forEach(x => { const inc = x.wages + Math.max(0, x.rent); if (inc > 0 && x.p.stats.tax < inc) facts.push(`${x.p.name} paid ${Math.round(x.p.stats.tax / inc * 100)}% of their income in tax.`); });
    const bust = rank.filter(p => p.bankrupt); if (bust.length) facts.push(`${bust.map(p => p.name).join(', ')} went bankrupt.`);
    const borrowers = rank.filter(p => p.stats.interest > 0); if (borrowers.length) facts.push(`${borrowers.map(p => `${p.name} paid ${fmt(p.stats.interest, true)} in loan interest`).join('; ')}.`);
    const rows = rank.map((p, i) => { const bg = D.BACKGROUNDS.find(b => b.id === p.bg); return `<tr><td>${i === 0 && !p.bankrupt ? '🏆' : i + 1}</td><td><b style="color:${p.color}">${esc(p.name)}</b><br><span class="muted">${bg ? bg.icon + ' ' + esc(bg.title) : ''}</span></td><td class="r">${fmt(p.startNW, true)}</td><td class="r"><b>${p.bankrupt ? 'bankrupt' : fmt(g.netWorth(p), true)}</b></td><td>${bar(p.stats.wages, 'var(--accent)')}</td><td>${bar(p.stats.rentGot - p.stats.rentPaid, 'var(--good)')}</td><td class="r">${fmt(p.stats.tax, true)}</td><td class="r">${p.stats.medical ? fmt(p.stats.medical, true) : '–'}</td></tr>`; }).join('');
    modal({ title: st.winner !== null ? `${g.player(st.winner).name} wins` : 'Game over', wide: true, html: `<div class="twrap"><table class="t"><thead><tr><th>#</th><th>Player</th><th class="r">Started</th><th class="r">Finished</th><th>From working</th><th>From rent (net)</th><th class="r">Tax paid</th><th class="r">Medical</th></tr></thead><tbody>${rows}</tbody></table></div>
      <h3 style="font-size:16px;margin:14px 0 6px">Net worth, round by round</h3><canvas class="chart" id="chart" width="800" height="160"></canvas><div class="muted" style="font-size:12px">${rank.map(p => `<span style="color:${p.color}">■</span> ${esc(p.name)}`).join(' &nbsp; ')}</div>
      <h3 style="font-size:16px;margin:14px 0 6px">What this game showed</h3><ul class="facts">${facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
      <h3 style="font-size:16px;margin:14px 0 6px">Talk about it</h3><ul class="facts"><li>Who worked the most? Who finished richest? Are those the same people?</li><li>What could the poorest player have done differently? What could they not change?</li><li>Which World cards hurt everyone, and which only hurt some people?</li><li>Is this game fair? Is Monopoly? Is the real economy?</li></ul>`, options: [{ id: 'menu', label: 'New game' }, { id: 'stay', label: 'Look at the board' }], onRender: box => drawChart(box.querySelector('#chart')) })
      .then(r => { if (r === 'menu') { try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ } location.reload(); } });
  }
  function drawChart(cv) {
    const g = ui.game, st = g.state; if (!cv) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    const n = Math.max(2, ...st.players.map(p => p.history.length));
    const all = st.players.flatMap(p => p.history.concat([p.startNW])); const max = Math.max(1, ...all), min = Math.min(0, ...all);
    const x = i => i / (n - 1) * (W - 20) + 10, y = v => H - 10 - (v - min) / (max - min) * (H - 20);
    const cs = getComputedStyle(document.documentElement);
    ctx.strokeStyle = cs.getPropertyValue('--line').trim(); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, y(0)); ctx.lineTo(W, y(0)); ctx.stroke(); ctx.setLineDash([]);
    st.players.forEach(p => { const h = [p.startNW].concat(p.history); ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.beginPath(); h.forEach((v, i) => { if (i === 0) ctx.moveTo(x(i), y(v)); else ctx.lineTo(x(i), y(v)); }); ctx.stroke(); });
    ctx.fillStyle = cs.getPropertyValue('--muted').trim(); ctx.font = '11px sans-serif'; ctx.fillText(fmt(max, true), 12, 12);
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
    const m = $('#modal'); if (m && !m.hidden) return;
    const b = document.querySelector('.act.mine .btns .btn.primary'); if (b && !b.disabled) { e.preventDefault(); b.click(); }
  });

  renderSetup();
  window.REC = ui;
})();
