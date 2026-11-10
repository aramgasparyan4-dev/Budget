/* Neural Kick — level data.
   Legend: # ground   - one-way platform   ^ v < > spikes   o token   ? token block
           J spring   E bug (walker)   F ghost (floater)   C checkpoint   G goal   P start */
(function (g) {
  'use strict';
  const NK = (g.NK = g.NK || {});

  const L1 = {
    id: 'boot', name: 'Boot Sequence', sub: 'Run, jump, kick off walls', pal: 0,
    chunks: [
      { signs: [{ x: 8, y: 1.6, text: 'Run right. Hold jump to go higher.' }], rows: [
        '#                     ',
        '#                     ',
        '#                     ',
        '#                     ',
        '#          ooo        ',
        '#                     ',
        '#  P                  ',
        '######################',
        '######################'] },
      { signs: [{ x: 9.5, y: 0.7, text: 'Bump blocks from below' }, { x: 18, y: 3.2, text: 'Land on bugs to squash them' }], rows: [
        '                        ',
        '                        ',
        '        ?o?             ',
        '                        ',
        '                        ',
        '                 E      ',
        '########################',
        '########################'] },
      { rows: [
        '                          ',
        '                          ',
        '              ooo         ',
        '            ##            ',
        '        ##  ##       ##   ',
        '    ##  ##  ##       ##   ',
        '##############   #########',
        '##############   #########'] },
      { signs: [{ x: 14, y: 0.3, text: 'Jump at a wall to grab it.\nJump again to kick across.' }], rows: [
        '                    ',
        '                    ',
        '     ooo            ',
        '                    ',
        '         E    E    #',
        '####################',
        '####################'] },
      { rise: 8, rows: [
        '   ##             ',
        '   ##             ',
        '   ##             ',
        '   ##      o o o  ',
        '   ##   ##########',
        '   ##o  ##########',
        '   ##   ##########',
        '   ## o ##########',
        '   ##   ##########',
        '   ##o  ##########',
        '        ##########',
        '        ##########',
        '##################',
        '##################'] },
      { rise: -5, rows: [
        '                      ',
        '        ooo           ',
        '       -----          ',
        '                      ',
        '            F         ',
        '                      ',
        '   C                  ',
        '######################',
        '######################'] },
      { signs: [{ x: 9, y: 3.4, text: 'Springs launch you' }], rows: [
        '                   G  ',
        '                  ####',
        '               o  ####',
        '               o  ####',
        '               o  ####',
        '                  ####',
        '      --          ####',
        '                  ####',
        '    ^^^^^^     J  ####',
        '######################',
        '######################'] },
    ],
  };

  const L2 = {
    id: 'context', name: 'Context Window', sub: 'Spiked shafts and long drops', pal: 1,
    chunks: [
      { rows: [
        '#                       ',
        '#                       ',
        '#                       ',
        '#             oo        ',
        '#           F           ',
        '#  P                    ',
        '#########  ####  #######',
        '#########  ####  #######'] },
      { rise: 12, rows: [
        '  ##            ',
        '  ##            ',
        '  ##            ',
        '  ##     o  C   ',
        '  ##    ########',
        '  ##    ########',
        '  ##>   ########',
        '  ##>   ########',
        '  ##    ########',
        '  ##   <########',
        '  ##   <########',
        '  ##    ########',
        '  ##  o ########',
        '  ##    ########',
        '        ########',
        '        ########',
        '################',
        '################'] },
      { rows: [
        '                      ',
        '                      ',
        '      ?  ?            ',
        '                      ',
        '                      ',
        '            E     E   ',
        '######################',
        '######################'] },
      { rise: -10, rows: [
        '                    ',
        '              ooo   ',
        '             -----  ',
        '                    ',
        '       ---          ',
        '                    ',
        '   --               ',
        '                    ',
        '  ^^^^^^^^^^^^^^^^  ',
        '####################',
        '####################'] },
      { rows: [
        '              ',
        '              ',
        '              ',
        '              ',
        '###     ######',
        '###  o  ######',
        '###>    ######',
        '###> o  ######',
        '###    <######',
        '###  o <######',
        '###>    ######',
        '###     ######',
        '###           ',
        '###  o o o  C ',
        '##############',
        '##############'] },
      { rows: [
        '                            ',
        '                         G  ',
        '                       #####',
        '               ooo     #####',
        '             -------   #####',
        '                       #####',
        '                       #####',
        '        o              #####',
        '        o              #####',
        '        J   E       J  #####',
        '############################',
        '############################'] },
    ],
  };

  const L3 = {
    id: 'descent', name: 'Gradient Descent', sub: 'Tight kicks, no slack', pal: 2,
    chunks: [
      { rows: [
        '#                         ',
        '#                         ',
        '#        o     o     o    ',
        '#                         ',
        '#              F          ',
        '#  P         ^^           ',
        '#######  ########  #######',
        '#######  ########  #######'] },
      { rise: 14, rows: [
        ' ##             ',
        ' ##             ',
        ' ##             ',
        ' ##      o o C  ',
        ' ##     ########',
        ' ##     ########',
        ' ##>    ########',
        ' ##>    ########',
        ' ##     ########',
        ' ##    <########',
        ' ##    <########',
        ' ##     ########',
        ' ##>    ########',
        ' ##>    ########',
        ' ##     ########',
        ' ##  o  ########',
        '        ########',
        '        ########',
        '################',
        '################'] },
      { rows: [
        '                        ',
        '                        ',
        '    ?    ???            ',
        '                        ',
        '                  F     ',
        '       E  ^^  E         ',
        '########################',
        '########################'] },
      { rows: [
        '                        ',
        '      o     o           ',
        '                        ',
        '                 F      ',
        '        ##    ##        ',
        '   ##   ##    ##   ##   ',
        '   ##   ##    ##   ##   ',
        '   ##^^^##^^^^##^^^##   ',
        '########################',
        '########################'] },
      { rise: 10, rows: [
        '  ##          ',
        '  ##          ',
        '  ##          ',
        '  ##     o o  ',
        '  ##   #######',
        '  ##   #######',
        '  ##   #######',
        '  ##>  #######',
        '  ##   #######',
        '  ##  <#######',
        '  ##   #######',
        '  ##>  #######',
        '       #######',
        '       #######',
        '##############',
        '##############'] },
      { rows: [
        '                          ',
        '                          ',
        '        ooo               ',
        '       -----        ##    ',
        '             F      ##    ',
        '   C    E      E    ## G  ',
        '##########################',
        '##########################'] },
    ],
  };

  NK.LEVELS = [L1, L2, L3];

  NK.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Endless mode: a tall random tower made of kick shafts, rooms and ledge runs. */
  NK.buildTower = function (seed, rows) {
    const rnd = NK.rng(seed), W = 13, IN = W - 2;
    rows = rows || 700;
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const set = (s, x, c) => s.substring(0, x) + c + s.substring(x + 1);
    const open = () => '#' + ' '.repeat(IN) + '#';
    const up = ['#'.repeat(W), '#'.repeat(W)]; // rows listed bottom-up
    up.push(set(open(), 6, 'P'), open(), open());
    let anchor = null;      // columns of the last ledge, or null when standing on a full floor
    let hole = null;        // [x0, x1] gap in the floor under the current room

    const addShaft = () => {
      const diff = Math.min(1, up.length / 350);
      const sw = rnd() < 0.25 ? 5 : rnd() < 0.5 ? 3 : 4;
      let sx;
      if (anchor) { const c = anchor[0] + 1; sx = Math.max(1, Math.min(W - 1 - sw, c - ri(0, sw - 1))); }
      else sx = ri(1, W - 1 - sw);
      const n = ri(6, 10), seg = [];
      for (let i = 0; i < n; i++) seg.push('#'.repeat(sx) + ' '.repeat(sw) + '#'.repeat(W - sx - sw));
      if (n >= 7 && rnd() < 0.25 + diff * 0.6) {
        const k = ri(2, n - 4), left = rnd() < 0.5;
        for (let j = 0; j < 2; j++) seg[k + j] = set(seg[k + j], left ? sx : sx + sw - 1, left ? '>' : '<');
        if (n >= 10 && rnd() < diff) {
          const k2 = k >= 5 ? k - 3 : k + 4;
          if (k2 >= 2 && k2 <= n - 3) seg[k2] = set(seg[k2], left ? sx + sw - 1 : sx, left ? '<' : '>');
        }
      }
      if (rnd() < 0.6) { const cy = ri(1, n - 2), cx = sx + (sw >> 1); if (seg[cy][cx] === ' ') seg[cy] = set(seg[cy], cx, 'o'); }
      for (const s of seg) up.push(s);
      hole = [sx, sx + sw - 1]; anchor = null;
    };

    const addRoom = () => {
      const diff = Math.min(1, up.length / 350);
      let r = open();
      const free = [];
      for (let x = 1; x <= IN; x++) if (!hole || x < hole[0] - 1 || x > hole[1] + 1) free.push(x);
      if (free.length > 2 && rnd() < 0.15 + diff * 0.5) r = set(r, free[ri(0, free.length - 1)], 'E');
      if (free.length && rnd() < 0.5) { const x = free[ri(0, free.length - 1)]; if (r[x] === ' ') r = set(r, x, 'o'); }
      up.push(r, open(), open());
      anchor = null;
    };

    const addLedges = () => {
      const diff = Math.min(1, up.length / 350);
      const n = ri(2, 4);
      let px = anchor ? anchor[0] : hole ? Math.max(1, Math.min(IN - 2, hole[0] + ri(-3, 3))) : ri(1, IN - 2);
      let pw = 3;
      for (let i = 0; i < n; i++) {
        if (i > 0 || anchor) {
          const lo = Math.max(1, px - 5), hi = Math.min(W - 1 - pw, px + pw + 2);
          let nx = ri(lo, hi);
          if (Math.abs(nx - px) < 2) nx = nx + 3 <= hi ? nx + 3 : Math.max(lo, nx - 3);
          px = nx;
        }
        let a = open(), b = open();
        if (rnd() < 0.5) b = set(b, px + 1, 'o');
        if (i > 0 && rnd() < diff * 0.35) { const fx = px > 6 ? ri(1, 3) : ri(8, 10); a = set(a, fx, 'F'); }
        up.push(a, b, set(set(set(open(), px, '-'), px + 1, '-'), px + 2, '-'));
        anchor = [px, px + pw - 1];
      }
      up.push(open(), open());
      hole = null;
    };

    let last = 'room';
    while (up.length < rows - 16) {
      if (last === 'shaft') {
        if (rnd() < 0.6) { addRoom(); last = 'room'; } else { anchor = null; addLedges(); last = 'ledges'; }
      } else { addShaft(); last = 'shaft'; }
    }
    if (last !== 'shaft') addShaft();
    up.push(set(open(), 6, 'G'), open(), open(), open());
    const grid = [];
    for (let i = up.length - 1; i >= 0; i--) grid.push(up[i].split(''));
    return NK.finishLevel({ id: 'tower', name: 'The Tower', sub: 'Endless climb', mode: 'tower', pal: 3 }, grid);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
