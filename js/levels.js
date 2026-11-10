/* Neural Kick — room chunks and the per-run floor generator.
   Terrain: # ground   - one-way platform   ^ spikes   J spring
   Markers: P start  D exit door  e ground enemy  f wisp  t spambot  b heavy enemy
            c gold  T chest  U upgrade chip  B boss */
(function (g) {
  'use strict';
  const NK = (g.NK = g.NK || {});
  const G22 = '######################', G24 = '########################', G20 = '####################', G18 = '##################';

  const START = { rows: ['#', '#', '#', '#', '#', '#  P', '##############', '##############'] };
  const EXIT = { rows: ['             #', '             #', '             #', '             #', '             #', '         D   #', '##############', '##############'] };
  const BOSS = { tag: 'boss', rows: [
    '', '', '',
    '      ----          ----',
    '', '',
    '                     B',
    '################################',
    '################################'] };
  const CHIP = { rows: ['', '        U', '       ###', '', '   e          b', G18, G18] };

  const POOL = [
    { rows: ['', '', '        c  c  c', '', '    e        e     e', G22, G22] },
    { rows: [
      '           t',
      '         -----',
      '    c            c',
      '   ---          ---',
      '',
      '  e   ^^^^^^^^^^   e',
      G22, G22] },
    { rise: 8, rows: [
      '   ##',
      '   ##',
      '   ##',
      '   ##      e   c',
      '   ##   ##########',
      '   ##c  ##########',
      '   ##   ##########',
      '   ## c ##########',
      '   ##   ##########',
      '   ##c  ##########',
      '        ##########',
      '        ##########',
      G18, G18] },
    { rise: -6, rows: ['', '    c c c', '', '   e       f      e', G20, G20] },
    { rows: [
      '',
      '      c     c',
      '',
      '                 f',
      '        ##    ##',
      '   ##   ##    ##   ##',
      '   ##   ##    ##   ##',
      '   ##^^^##^^^^##^^^##',
      G24, G24] },
    { rows: ['', '     e      c      t', '   ------------------', '', '  e       c       e', G24, G24] },
    { rise: 6, rows: [
      '',
      '              e   c',
      '           #########',
      '           #########',
      '     c     #########',
      '     c     #########',
      '           #########',
      '   e     J #########',
      G20, G20] },
    { rows: [
      '',
      '         T',
      '        ---',
      '      ##   ##',
      '      ##   ##',
      '      ##   ##',
      '      ##   ##',
      '',
      '  e              e',
      G20, G20] },
    { rows: ['', '', '   t              t', '  ###            ###', '        e    e', G22, G22] },
    { rise: 4, rows: [
      '',
      '             e  c',
      '            ######',
      '         #########',
      '      ############',
      '   ###############',
      G18, G18] },
    { rows: [G22, G22, '', '   f      f      f', '', '         ^^', G22, G22] },
    { rows: ['', '      c        c', '    -----    -----', '', '   e      b       e', G24, G24] },
    { rise: -3, rows: ['', '  c c', '', '    e      f', '################', '################'] },
    { rows: [
      '',
      '    c      T      c',
      '   ---    ---    ---',
      '',
      '',
      '  ^^^^  e  f  ^^^^',
      G20, G20] },
  ];
  NK.CHUNKS = { START, EXIT, BOSS, CHIP, POOL };

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

  /* depth 0,1,2 = the three floors; 3+ loops them, harder. */
  NK.genFloor = function (depth, seed) {
    const rnd = NK.rng(seed * 7919 + depth * 104729 + 13), F = NK.FLOORS[depth % 3], loop = Math.floor(depth / 3);
    const chunks = [START], used = new Set();
    const chipAt = Math.floor(rnd() * F.len);
    for (let i = 0; i < F.len; i++) {
      let k, tries = 0;
      do { k = Math.floor(rnd() * POOL.length); tries++; } while (used.has(k) && tries < 20);
      used.add(k);
      chunks.push(POOL[k]);
      if (i === chipAt) chunks.push(CHIP);
    }
    if (F.boss) chunks.push(BOSS);
    chunks.push(EXIT);
    const L = NK.buildLevel({ name: F.name, pal: (F.pal + loop) % 4, chunks });
    L.depth = depth; L.loop = loop; L.floor = F; L.seed = seed;
    return L;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
