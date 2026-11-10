/* Neural Kick — tuning data: weapons, perks, permanent upgrades, enemies, floors. */
(function (g) {
  'use strict';
  const NK = (g.NK = g.NK || {});

  /* time = seconds per swing; range/h = hit box in front of the player; combo = damage multiplier per hit */
  NK.WEAPONS = {
    sword: { id: 'sword', slot: 'main', name: 'Rusty Sword', dmg: 14, time: 0.3, range: 48, h: 42, kb: 170, combo: [1, 1, 1.8], color: '#d7deee', desc: 'Balanced three-hit combo.' },
    daggers: { id: 'daggers', slot: 'main', name: 'Twin Daggers', dmg: 8, time: 0.16, range: 36, h: 34, kb: 60, combo: [1, 1, 1, 1.6], back: 2, color: '#9ff0d8', desc: 'Very fast. Double damage from behind.' },
    pike: { id: 'pike', slot: 'main', name: 'Pike', dmg: 13, time: 0.36, range: 80, h: 24, kb: 220, combo: [1, 1.5], color: '#ffd75e', desc: 'Long reach, keeps enemies away.' },
    sledge: { id: 'sledge', slot: 'main', name: 'Sledge', dmg: 30, time: 0.6, range: 56, h: 54, kb: 400, combo: [1, 1.6], stun: 0.7, color: '#ff9d6b', desc: 'Slow and heavy. Staggers anything.' },
    blaster: { id: 'blaster', slot: 'alt', kind: 'gun', name: 'Blaster', dmg: 9, ammo: 6, reload: 1.0, color: '#6cb6ff', desc: 'Six shots that recharge.' },
    bombs: { id: 'bombs', slot: 'alt', kind: 'bomb', name: 'Bombs', dmg: 36, ammo: 2, reload: 3.2, color: '#ff5d73', desc: 'Lobbed blast, hits a crowd.' },
  };
  NK.weaponName = (w) => NK.WEAPONS[w.id].name + (w.tier ? ' +' + w.tier : '');
  NK.weaponDmg = (w) => Math.round(NK.WEAPONS[w.id].dmg * (1 + 0.3 * (w.tier || 0)));

  /* perks: picked one-of-three from upgrade chips; apply(run, body) mutates the run */
  NK.PERKS = [
    { id: 'overclock', name: 'Overclock', desc: '+20% damage', apply(r) { r.dmgMul += 0.2; } },
    { id: 'thick', name: 'Thick Shell', desc: '+25 max HP and heal 25', apply(r) { r.maxhp += 25; r.hp = Math.min(r.maxhp, r.hp + 25); } },
    { id: 'vamp', name: 'Garbage Collector', desc: 'Heal 3 HP per kill', apply(r) { r.vamp += 3; } },
    { id: 'quick', name: 'Quick Hands', desc: '+20% attack speed', apply(r) { r.atkSpd += 0.2; } },
    { id: 'reach', name: 'Long Reach', desc: '+25% melee range', apply(r) { r.reach += 0.25; } },
    { id: 'crit', name: 'Critical Path', desc: '+20% chance to deal double damage', apply(r) { r.crit += 0.2; } },
    { id: 'airjump', name: 'Air Jump', desc: 'One extra jump in mid-air', apply(r) { r.airJumps += 1; } },
    { id: 'roller', name: 'Hot Reload', desc: 'Roll recharges 45% faster', apply(r) { r.rollCd *= 0.55; } },
    { id: 'swift', name: 'Low Latency', desc: '+12% move speed', apply(r) { r.spd += 0.12; } },
    { id: 'greed', name: 'Token Hoarder', desc: '+40% gold from everything', apply(r) { r.goldMul += 0.4; } },
    { id: 'revive', name: 'Backup', desc: 'Revive once at 40% HP', once: true, apply(r) { r.revive += 1; } },
    { id: 'slam', name: 'Hard Landing', desc: 'Dive slam deals triple damage', once: true, apply(r) { r.slamMul = 3; } },
  ];

  /* permanent upgrades bought with banked cores in the hub */
  NK.UPGRADES = [
    { id: 'vit', name: 'Vitality', desc: '+15 max HP per level', cost: [10, 20, 35, 55, 80] },
    { id: 'edge', name: 'Sharper Edge', desc: '+8% damage per level', cost: [12, 25, 40, 60, 90] },
    { id: 'flask', name: 'Extra Hotfix', desc: '+1 heal charge per level', cost: [25, 70] },
    { id: 'purse', name: 'Seed Money', desc: 'Start each run with +40 gold per level', cost: [10, 25, 45] },
    { id: 'keep', name: 'Core Insurance', desc: 'Keep 25% more carried cores when you die', cost: [20, 50] },
    { id: 'pike', name: 'Unlock: Pike', desc: 'Adds the Pike to weapon drops', cost: [20] },
    { id: 'sledge', name: 'Unlock: Sledge', desc: 'Adds the Sledge to weapon drops', cost: [30] },
    { id: 'bombs', name: 'Unlock: Bombs', desc: 'Adds Bombs to weapon drops', cost: [30] },
  ];

  NK.ENEMIES = {
    bug: { name: 'Bug', hp: 30, dmg: 12, w: 26, h: 20, gold: 3, cores: 1 },
    wisp: { name: 'Wisp', hp: 16, dmg: 8, w: 22, h: 22, gold: 2, cores: 1, fly: true },
    glitch: { name: 'Glitch', hp: 22, dmg: 10, w: 22, h: 22, gold: 3, cores: 1 },
    spam: { name: 'Spambot', hp: 26, dmg: 10, w: 24, h: 28, gold: 4, cores: 1 },
    bloat: { name: 'Bloatware', hp: 90, dmg: 22, w: 38, h: 42, gold: 9, cores: 3, armor: true },
    boss: { name: 'SEGFAULT', hp: 520, dmg: 20, w: 62, h: 58, gold: 60, cores: 25, armor: true },
  };

  /* three floors per loop; the third ends in a boss. ground = weights for 'e' markers */
  NK.FLOORS = [
    { name: 'Boot Sector', pal: 0, len: 5, ground: { bug: 6, glitch: 1 } },
    { name: 'The Heap', pal: 1, len: 6, ground: { bug: 3, glitch: 3, bloat: 1 } },
    { name: 'Kernel Space', pal: 2, len: 4, ground: { bug: 2, glitch: 3, bloat: 2 }, boss: true },
  ];
})(typeof globalThis !== 'undefined' ? globalThis : this);
