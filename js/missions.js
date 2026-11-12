/* Sundown Protocol — story missions, repeatable bounties, and the high-noon duel. No DOM here. */
(function (g) {
  'use strict';
  const SD = g.SD;
  const sfx = (n) => SD.sfx && SD.sfx(n);
  const rand = (a, b) => a + Math.random() * (b - a);
  const alive = (tag) => SD.G.actors.filter((a) => a.tag === tag && !a.dead && !a.out);
  const pay = (n, rep, why) => { const sv = SD.save; sv.money += n; sv.rep = Math.max(-100, Math.min(100, sv.rep + (rep || 0))); SD.emit('reward', { money: n, rep, why }); };

  SD.MISSIONS = [
    {
      title: 'New in Town', giver: 'sheriff', who: 'Sheriff Ada Whitlock',
      brief: 'A tin can on legs wants work? Fine. Show me you can shoot. I lined up three bottles on the rail yard fence, west end of town.',
      start() { for (const x of [470, 506, 542]) SD.spawn('bottle', x, { tag: 'm0', y: SD.ground(x) - 24, persist: true }); },
      objective() { return 'Shoot the bottles on the fence (' + alive('m0').length + ' left)'; },
      marker() { return 506; },
      update() { if (!alive('m0').length) { pay(10, 2, 'Sharp shooting'); return true; } },
    },
    {
      title: 'Rattler Run', giver: 'sheriff', who: 'Sheriff Ada Whitlock',
      brief: 'The Rattler gang camps in the gulch east of the plains. They rob every wagon that passes. Clear them out. Take your horse: press H to whistle for Biscuit.',
      start() { SD.gangAt(SD.SPOTS.camp, ['bandit', 'bandit', 'knife', 'bandit', 'rifle', 'bandit'], { tag: 'm1', persist: true }); SD.addAlly('Deputy Walt Greer', SD.SPOTS.sheriff + 50, 100); },
      intro: [['Sheriff Ada', 'Walt rides with you. Try to bring him back in one piece.'], ['Deputy Walt', 'Whistle up your horse, partner. It is a long way east.']],
      talk: [[2850, 'Deputy Walt', 'Never rode with a machine before. Do I feed you or oil you?'], [3500, 'Deputy Walt', 'Rattlers hit the noon stage last week. Took the mail and the mule.'],
        [4200, 'Deputy Walt', 'They keep a rifleman at the back of the camp. Mind him first.'], [4820, 'Deputy Walt', 'This is it. Use the wagon for cover and pick your shots.']],
      outro: [['Deputy Walt', 'Hell of a thing. I will tell Ada you shoot better than you look.']],
      objective() { const n = alive('m1').length; return 'Clear the Rattler camp in the gulch (' + n + ' left)'; },
      marker() { const a = alive('m1')[0]; return a ? a.x : SD.SPOTS.camp; },
      update() { if (!alive('m1').length) { pay(60, 5, 'Rattler camp cleared'); return true; } },
    },
    {
      title: 'Two-Bit Pete', giver: 'sheriff', who: 'Sheriff Ada Whitlock',
      brief: 'Two-Bit Pete holes up in a shack on the plains. Wound him and he will give up; tie him with E and bring him here. Alive pays $80. Dead pays $35.',
      start() {
        SD.spawn('outlaw', SD.SPOTS.shack, { tag: 'm2', name: 'Two-Bit Pete', persist: true, hat: '#1f1a17', shirt: '#7a2e2a', target: true });
        SD.gangAt(SD.SPOTS.shack + 40, ['bandit', 'knife'], { tag: 'm2g', persist: true });
      },
      objective() { return SD.G.p.carry ? 'Take Pete to the sheriff (E at the door)' : 'Bring in Two-Bit Pete, alive or dead'; },
      marker() { if (SD.G.p.carry) return SD.SPOTS.sheriff; const a = SD.G.actors.find((x) => x.tag === 'm2'); return a ? a.x : SD.SPOTS.shack; },
      update() { return SD.save.stage === 'delivered'; },
    },
    {
      title: "Hunter's Order", giver: 'store', who: 'Hollis, storekeeper',
      brief: 'I need hides for a buyer back east. Two deer and three rabbits. Deer graze by the river. Do it and that Repeater on the wall is yours.',
      start() {},
      objective() { const p = SD.save.pelts; return 'Hides for Hollis: deer ' + Math.min(2, p.deer) + '/2, rabbit ' + Math.min(3, p.rabbit) + '/3'; },
      marker() { const p = SD.save.pelts; return p.deer >= 2 && p.rabbit >= 3 ? SD.SPOTS.store : p.deer < 2 ? SD.SPOTS.river : 3300; },
      update() { return SD.save.stage === 'delivered'; },
      turnIn() {
        const p = SD.save.pelts;
        if (p.deer < 2 || p.rabbit < 3) return false;
        p.deer -= 2; p.rabbit -= 3; SD.save.guns.rifle = true; SD.save.ammo.rifle += 16; SD.save.stage = 'delivered';
        pay(30, 3, 'Hides delivered. The Repeater is yours (press 2)');
        return true;
      },
    },
    {
      title: 'High Noon', giver: 'saloon', who: 'Mags, saloon keeper',
      brief: 'Silas Crane rode in. He runs what is left of the Rattlers and he is calling you out in the street. Wait for the word, then draw. Not before.',
      start() { SD.startDuel(); },
      objective() {
        const st = SD.save.stage;
        return st === 'ambush' ? 'Survive the Rattler ambush (' + alive('m3b').length + ' left)' : SD.G.duel ? 'Wait for DRAW, then click' : 'Put Silas Crane down';
      },
      marker() { const a = alive('m3b')[0] || alive('m3')[0]; return a ? a.x : SD.SPOTS.duel; },
      update() {
        const sv = SD.save, p = SD.G.p;
        if (!sv.stage && !SD.G.duel && !alive('m3').length) {
          sv.stage = 'ambush'; SD.say('Ambush! Rattlers on both sides.', 2.4);
          SD.gangAt(p.x - 520, ['bandit', 'bandit'], { tag: 'm3b', alert: true, persist: true });
          SD.gangAt(p.x + 520, ['bandit', 'rifle'], { tag: 'm3b', alert: true, persist: true });
        }
        if (sv.stage === 'ambush' && !alive('m3b').length) { for (const a of SD.G.actors) if (a.kind === 'folk') a.inside = false; pay(100, 5, 'Silas Crane is done'); return true; }
      },
    },
    {
      title: "Widow's Mine", giver: 'sheriff', who: 'Sheriff Ada Whitlock',
      brief: 'The last of the gang works for a man they call the Foreman, up at the old mine. He throws dynamite. Bring tonics and plenty of rounds.',
      start() {
        SD.addAlly('Sheriff Ada Whitlock', SD.SPOTS.sheriff + 40, 90, { hat: '#3a2a20', shirt: '#8a4a3a' }); SD.addAlly('Deputy Walt Greer', SD.SPOTS.sheriff + 90, 170);
        SD.gangAt(8300, ['bandit', 'bandit'], { tag: 'm5', persist: true });
        SD.gangAt(8750, ['rifle', 'bandit', 'knife'], { tag: 'm5', persist: true });
        SD.gangAt(9150, ['bandit', 'rifle'], { tag: 'm5', persist: true });
        SD.spawn('foreman', 9520, { tag: 'm5', name: 'The Foreman', persist: true, hat: '#6b5a2a', shirt: '#4a4a52', boss: true });
        SD.gangAt(9440, ['bandit', 'knife'], { tag: 'm5', persist: true });
      },
      intro: [['Sheriff Ada', 'I am done sending you alone. Walt and I ride with you this time.']],
      talk: [[4000, 'Sheriff Ada', 'Twenty years I kept this county quiet. One gang nearly undid it.'], [6700, 'Deputy Walt', 'River is high. Deer everywhere. Shame we are not here to hunt.'],
        [7900, 'Sheriff Ada', 'Mine road. They will have guns on every bend. Stay sharp.'], [9150, 'The Foreman', 'You brought the law to MY hill? Light the fuses, boys!']],
      outro: [['Sheriff Ada', 'It is over. Drinks are on the county tonight.']],
      objective() { const f = SD.G.actors.find((a) => a.kind === 'foreman' && !a.dead); return f ? 'Take down the Foreman at Widow\'s Mine' : 'Finish the gang (' + alive('m5').length + ' left)'; },
      marker() { const f = SD.G.actors.find((a) => a.kind === 'foreman' && !a.dead) || alive('m5')[0]; return f ? f.x : SD.SPOTS.mine; },
      update() { if (!alive('m5').length) { pay(250, 10, 'The Rattlers are finished'); SD.emit('ending'); return true; } },
    },
  ];

  /* save.mission = index of the next story mission; save.active = it has been accepted */
  SD.missionNow = () => { const sv = SD.save; return sv.active ? SD.MISSIONS[sv.mission] : null; };
  SD.acceptMission = function () {
    const sv = SD.save, m = SD.MISSIONS[sv.mission];
    if (!m || sv.active) return;
    sv.active = true; sv.stage = null;
    m.start();
    for (const l of m.talk || []) l.done = false;
    SD.cineTitle('A job from ' + m.who.split(',')[0], m.title); if (m.intro) SD.talk(m.intro); sfx('job');
  };
  SD.resumeMission = function () { const m = SD.missionNow(); if (m && m.title !== 'High Noon') m.start(); else if (m) { SD.save.active = false; } };
  SD.stepMission = function () {
    const sv = SD.save, m = SD.missionNow();
    if (m && m.talk) for (const l of m.talk) if (!l.done && SD.G.p.x > l[0]) { l.done = true; SD.talk([[l[1], l[2]]]); }
    if (m && m.update()) { sv.active = false; sv.stage = null; sv.mission++; if (m.outro) SD.talk(m.outro); SD.dismissAllies(); SD.emit('missionDone', m); }
    stepBounty();
  };

  /* ---------- repeatable bounties ---------- */
  const FIRST = ['Mean', 'Lucky', 'Dutch', 'Cold', 'Slim', 'Rusty', 'Calico', 'Burnt', 'Whistling', 'Crooked'];
  const LAST = ['Jim Hollow', 'Etta Vane', 'Bo Tanner', 'Marlow Fisk', 'Nell Carver', 'Ike Pruitt', 'Josie Lark', 'Cal Barlow', 'Wade Stroud', 'Dot Kimble'];
  SD.makeBounty = function () {
    const spots = [3300, 4400, 5900, 7300, 8100, 8900], x = spots[Math.floor(Math.random() * spots.length)];
    const lvl = 1 + Math.min(4, SD.save.bountiesDone);
    return { name: FIRST[(Math.random() * FIRST.length) | 0] + ' ' + LAST[(Math.random() * LAST.length) | 0], x, alive: 50 + lvl * 20, dead: 25 + lvl * 8, guards: Math.min(4, 1 + lvl), spawned: false };
  };
  SD.acceptBounty = function (b) { SD.save.bounty = b; SD.say('Bounty: ' + b.name + ', last seen near ' + SD.regionAt(b.x).name, 3); sfx('job'); };
  function stepBounty() {
    const b = SD.save.bounty, G = SD.G;
    if (!b || b.spawned || Math.abs(G.p.x - b.x) > 1500) return;
    b.spawned = true;
    SD.spawn('outlaw', b.x, { tag: 'bounty', name: b.name, persist: true, hat: '#2a2320', shirt: '#6a3a2a', target: true });
    const kinds = ['bandit', 'knife', 'bandit', 'rifle'].slice(0, b.guards);
    SD.gangAt(b.x + 60, kinds, { tag: 'bountyg', persist: true });
  }
  SD.bountyMarker = function () {
    const b = SD.save.bounty, G = SD.G;
    if (!b) return null;
    if (G.p.carry && G.p.carry.tag === 'bounty') return SD.SPOTS.sheriff;
    const a = G.actors.find((x) => x.tag === 'bounty');
    return a ? a.x : b.x;
  };

  /* Hand a carried outlaw (alive or dead) to the sheriff. Returns a line for the menu, or null. */
  SD.deliver = function () {
    const G = SD.G, c = G.p.carry, sv = SD.save;
    if (!c) return null;
    G.p.carry = null;
    G.actors = G.actors.filter((a) => a !== c);
    const live = !c.dead;
    if (c.tag === 'm2') { sv.stage = 'delivered'; pay(live ? 80 : 35, live ? 6 : 0, 'Two-Bit Pete ' + (live ? 'jailed' : 'collected')); }
    else if (c.tag === 'bounty' && sv.bounty) { pay(live ? sv.bounty.alive : sv.bounty.dead, live ? 4 : 0, sv.bounty.name + (live ? ' jailed' : ' collected')); sv.bounty = null; sv.bountiesDone++; }
    return live ? 'Ada locks ' + c.name + ' in the cell.' : 'Ada signs for the body.';
  };

  /* ---------- the duel ---------- */
  SD.startDuel = function () {
    const G = SD.G, p = G.p, x = SD.SPOTS.duel;
    if (p.mounted) SD.dismount();
    p.x = x - 170; p.y = SD.ground(p.x); p.vx = 0; p.face = 1;
    G.horse.x = 2330; G.horse.y = SD.ground(2330); G.horse.mode = 'idle';
    for (const a of G.actors) if (a.kind === 'folk') a.inside = true; // townsfolk go indoors for the showdown
    const foe = SD.spawn('duelist', x + 170, { tag: 'm3', name: 'Silas Crane', face: -1, persist: true, hat: '#14110f', shirt: '#2b2b30' });
    G.duel = { stage: 'wait', t: rand(3.4, 5.4), foe, react: 0.6 };
    SD.talk([['Silas Crane', 'Nothing personal, tin man.']]);
  };
  SD.stepDuel = function (dt, inp) {
    const G = SD.G, d = G.duel, p = G.p;
    if (!d) return;
    d.t -= dt;
    p.vx = 0; p.face = 1;
    if (d.stage === 'wait') {
      if (inp.fire) { G.duel = null; d.foe.alert = true; SD.say('Too early. Silas shoots first.', 2.4); SD.hurtPlayer(40, -1); return; }
      if (d.t <= 0) { d.stage = 'draw'; d.t = d.react; SD.say('DRAW!', 1); sfx('draw'); }
    } else if (d.stage === 'draw') {
      if (inp.fire) {
        G.duel = null;
        p.gun = 'revolver';
        SD.fireShot(Math.atan2(d.foe.y - d.foe.h * 0.86 - (p.y - 11), d.foe.x - p.x), true);
        SD.save.clip.revolver = Math.max(0, SD.save.clip.revolver);
        SD.damage(d.foe, 999, 1, { head: true, gun: true });
        G.oc = 100; SD.say('Silas Crane drops.', 2);
        return;
      }
      if (d.t <= 0) { G.duel = null; d.foe.alert = true; d.foe.muzzle = 0.08; sfx('eshot'); SD.say('Too slow.', 2); SD.hurtPlayer(40, -1); }
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
