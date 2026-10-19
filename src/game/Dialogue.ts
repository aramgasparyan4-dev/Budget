import type { Session } from './Session';
import type { NPC, Memory, Place } from '../sim/npc/types';
import { personalitySummary, relStage } from '../sim/npc/types';
import { npcName } from '../sim/npc/Population';
import { RNG } from '../core/rng';
import { clamp } from '../core/math';
import { useDialogue, DialogueOptionView } from '../state/uiStores';
import { useStore } from '../state/store';
import * as L from '../sim/dialogue/lines';
import { llmRespond } from '../sim/dialogue/LLM';
import { fmtTime, MIN_PER_DAY } from '../sim/Clock';
import { Pose } from '../render/Human';
import type { BusinessType } from '../world/types';

export interface DialogueTarget {
  npc: NPC;
  x: number;
  z: number;
  y: number;
  release: () => void;
}

type Menu = 'main' | 'help' | 'directions' | 'gift' | 'hangout' | 'end';

const DIRECTIONS: { id: string; label: string; types: BusinessType[] }[] = [
  { id: 'food', label: 'Somewhere to eat', types: ['cafe', 'restaurant', 'fastfood'] },
  { id: 'shop', label: 'A store', types: ['convenience', 'grocery'] },
  { id: 'clothes', label: 'Clothing store', types: ['clothing'] },
  { id: 'bank', label: 'The bank', types: ['bank'] },
  { id: 'cars', label: 'Car dealership', types: ['dealership'] },
  { id: 'bar', label: 'A bar or club', types: ['bar', 'nightclub'] },
];

const GIFT_LOVE: Record<string, (n: NPC) => boolean> = {
  flowers: (n) => n.traits.kindness > 0.5 || n.female,
  chocolate: (n) => n.traits.sociability > 0.5,
  coffee: (n) => /Barista|Engineer|Analyst|Student/.test(n.title) || n.traits.ambition > 0.6,
  book: (n) => n.traits.curiosity > 0.6,
  wine: (n) => n.age > 30,
};

export class DialogueController {
  target: DialogueTarget | null = null;
  private menu: Menu = 'main';
  private rng = new RNG(Date.now() & 0xffff);
  private lines: { who: 'npc' | 'you'; text: string }[] = [];
  private asked = new Set<string>();
  private thinking = false;

  constructor(private s: Session) {}

  get active() {
    return !!this.target;
  }

  start(t: DialogueTarget) {
    const s = this.s;
    const n = t.npc;
    this.target = t;
    this.menu = 'main';
    this.lines = [];
    this.asked.clear();
    n.hold = 1;
    const p = s.ctl!.renderPos;
    s.game.cam.startDialogue(p, { x: t.x, y: t.y, z: t.z } as never);
    if (s.ctl) {
      s.ctl.forcedPose = Pose.Talk;
      s.ctl.poseAux = 0.3;
      s.ctl.yaw = Math.atan2(t.x - p.x, t.z - p.z);
    }
    useStore.getState().setOverlay('dialogue');
    s.game.input.exitLock();
    const first = n.relPlayer.fam <= 0 && !n.knowsPlayer;
    const v = L.voiceOf(n);
    const stage = relStage(n.relPlayer);
    let text: string;
    const sinceLast = s.t - n.lastTalk;
    if (sinceLast < 12 && !first) text = L.annoyedRepeat(this.rng, n.traits.patience > 0.5);
    else if (first) text = L.greetStranger(this.rng, n, v, s.clock.hour);
    else text = L.greetKnown(this.rng, n, v, stage, s.player.name);
    // reference a strong memory about the player
    const mem = s.nsys.recall(n, (m) => m.who.includes(-1) && m.type !== 'met_player' && m.type !== 'talked_player', 0.12)[0];
    if (mem && !first) {
      const ml = L.memoryLine(this.rng, mem, mem.place !== undefined ? s.nsys.placeName({ k: 'b', id: mem.place }) : null);
      if (ml) text = mem.valence < -0.3 ? ml : `${text} ${ml}`;
    }
    // appointment check-in
    const ap = n.appointment;
    if (ap && ap.with === -1 && !ap.done && s.t > ap.t - 40 && s.t < ap.t + 75 && n.loc && n.loc.k === ap.place.k && n.loc.id === ap.place.id) {
      text = this.rng.pick([`You made it! I was starting to wonder.`, `There you are! Right on time.`, `Hey! Glad you came.`]);
      this.menu = 'hangout';
    }
    if (first) {
      n.relPlayer.fam = Math.max(n.relPlayer.fam, 6);
      s.nsys.addMemory(n, 'met_player', [-1], 0.25, 0.1, n.loc?.k === 'b' ? n.loc.id : undefined);
    }
    n.knowsPlayer = true;
    n.lastTalk = s.t;
    this.say(text);
    this.publish();
  }

  private say(text: string) {
    this.lines.push({ who: 'npc', text });
    if (this.lines.length > 6) this.lines.shift();
    this.s.game.audio?.ui('type');
  }
  private you(text: string) {
    this.lines.push({ who: 'you', text });
    if (this.lines.length > 6) this.lines.shift();
  }

  private relDelta(d: Partial<{ fam: number; friend: number; trust: number; romance: number; rival: number; prof: number }>) {
    const r = this.target!.npc.relPlayer;
    if (d.fam) r.fam = clamp(r.fam + d.fam, 0, 100);
    if (d.friend) r.friend = clamp(r.friend + d.friend, -100, 100);
    if (d.trust) r.trust = clamp(r.trust + d.trust, -100, 100);
    if (d.romance) r.romance = clamp(r.romance + d.romance, 0, 100);
    if (d.rival) r.rival = clamp(r.rival + d.rival, 0, 100);
    if (d.prof) r.prof = clamp(r.prof + d.prof, 0, 100);
    r.last = this.s.t;
  }

  private options(): DialogueOptionView[] {
    const s = this.s;
    const n = this.target!.npc;
    const r = n.relPlayer;
    const att = s.nsys.attitude(n);
    const opts: DialogueOptionView[] = [];
    if (this.menu === 'hangout') {
      opts.push({ id: 'hang_drink', label: 'Grab something together ($15)', disabled: s.player.money < 15 });
      opts.push({ id: 'hang_talk', label: 'Talk about life' });
      opts.push({ id: 'hang_walk', label: 'Go for a walk' });
      opts.push({ id: 'bye', label: 'Goodbye' });
      return opts;
    }
    if (this.menu === 'help') {
      opts.push({ id: 'dir', label: 'I need directions' });
      opts.push({ id: 'jobs', label: "I'm looking for work" });
      opts.push({ id: 'lend', label: 'Could you lend me some money?', disabled: this.asked.has('lend') });
      opts.push({ id: 'back', label: 'Never mind' });
      return opts;
    }
    if (this.menu === 'directions') {
      for (const d of DIRECTIONS) opts.push({ id: `dir_${d.id}`, label: d.label });
      opts.push({ id: 'back', label: 'Back' });
      return opts;
    }
    if (this.menu === 'gift') {
      for (const it of s.player.inventory.filter((i) => i.kind === 'gift' || i.kind === 'food')) opts.push({ id: `gift_${it.id}`, label: `Give ${it.name}` });
      opts.push({ id: `gift_cash`, label: 'Give $20 cash', disabled: s.player.cash < 20 });
      opts.push({ id: 'back', label: 'Back' });
      return opts;
    }
    // main
    const jobs = s.jobs;
    const special = jobs?.dialogueOptions(n) ?? [];
    for (const o of special) opts.push(o);
    if (!this.asked.has('how')) opts.push({ id: 'how', label: 'How are you?' });
    if (!this.asked.has('work')) opts.push({ id: 'work', label: 'What do you do for work?' });
    if (!this.asked.has('news')) opts.push({ id: 'news', label: "What's happening around here?" });
    opts.push({ id: 'help', label: 'Can you help me?' });
    if (!this.asked.has('needhelp') && !n.requestOpen) opts.push({ id: 'needhelp', label: 'Need a hand with anything?' });
    if (r.fam > 12 && !this.asked.has('hang')) opts.push({ id: 'hang', label: 'Want to hang out?' });
    if (r.fam > 15 && !this.asked.has('day')) opts.push({ id: 'day', label: 'What does your day look like?' });
    if (!n.hasNumber && r.friend > 18 && att > 0) opts.push({ id: 'number', label: 'Can I get your number?' });
    if (n.age >= 21 && r.fam > 10 && !this.asked.has('flirt')) opts.push({ id: 'flirt', label: 'Flirt' });
    if (s.player.inventory.some((i) => i.kind === 'gift' || i.kind === 'food') || s.player.cash >= 20) opts.push({ id: 'giftmenu', label: 'Give a gift…' });
    if (att < -0.15 && !this.asked.has('sorry')) opts.push({ id: 'sorry', label: 'I want to apologize' });
    if (!this.asked.has('rude')) opts.push({ id: 'rude', label: 'Be rude', hint: 'They will remember' });
    opts.push({ id: 'bye', label: 'Goodbye' });
    return opts.slice(0, 9);
  }

  private publish() {
    const s = this.s;
    const t = this.target;
    if (!t) {
      useDialogue.getState().set(null);
      return;
    }
    const n = t.npc;
    const r = n.relPlayer;
    const known = n.knowsPlayer || r.fam > 0;
    const job = n.job ? s.city.businesses[n.job.biz].name : null;
    useDialogue.getState().set({
      npcId: n.id,
      name: known && this.asked.size + (r.fam > 8 ? 1 : 0) > 0 ? npcName(n) : r.fam > 8 ? npcName(n) : `${n.first}`,
      subtitle: `${n.title}${job ? ` · ${job}` : ''} · ${n.age}`,
      stage: relStage(r),
      traits: personalitySummary(n.traits),
      mood: n.mood,
      rel: { friend: r.friend, trust: r.trust, fam: r.fam, romance: r.romance },
      lines: [...this.lines],
      options: this.options(),
      thinking: this.thinking,
      schedule: this.asked.has('day') ? s.nsys.todaySchedule(n) : undefined,
    });
  }

  /** player picked an option */
  async choose(id: string) {
    if (!this.target || this.thinking) return;
    const s = this.s;
    const n = this.target.npc;
    const v = L.voiceOf(n);
    const r = this.rng;
    const opt = this.options().find((o) => o.id === id);
    if (!opt || opt.disabled) return;
    s.game.audio?.ui('click');
    if (id === 'back') {
      this.menu = 'main';
      this.publish();
      return;
    }
    if (id === 'help') {
      this.menu = 'help';
      this.you('Can you help me?');
      this.say(v.warm ? 'Sure, what do you need?' : v.blunt ? 'Depends. With what?' : 'What with?');
      this.publish();
      return;
    }
    if (id === 'giftmenu') {
      this.menu = 'gift';
      this.publish();
      return;
    }
    if (id === 'dir') {
      this.menu = 'directions';
      this.you('I need directions.');
      this.say('Where to?');
      this.publish();
      return;
    }
    // job-system options (deliveries, rides, requests, shifts)
    if (s.jobs?.handleDialogue(n, id, (who, text) => (who === 'npc' ? this.say(text) : this.you(text)))) {
      this.publish();
      return;
    }
    this.you(opt.label);
    let reply = '';
    let llmTopic = false;
    const placeName = n.loc ? s.nsys.placeName(n.loc) : 'here';
    switch (true) {
      case id === 'how': {
        this.asked.add('how');
        const recent = [...n.memories].reverse().find((m) => s.nsys.strength(m) > 0.1 && ['got_job', 'lost_job', 'business_closed', 'promoted', 'bought_car', 'dated_npc', 'argued_npc', 'late_for_work', 'stuck_in_traffic', 'bad_service', 'got_wet', 'attended_event'].includes(m.type));
        const recentName = recent && recent.who[0] !== undefined && recent.who[0] >= 0 ? npcName(s.npcs[recent.who[0]]) : null;
        reply = L.moodLine(r, n, v, {
          work: n.job ? s.city.businesses[n.job.biz].name : null,
          recent: recent ?? null,
          rain: s.weather.p.rain > 0.3,
          tired: n.needs.energy < 0.25,
          hungry: n.needs.hunger < 0.25,
          hour: s.clock.hour,
          recentName,
        });
        if (v.chatty && r.chance(0.5)) reply += ' ' + r.pick(['And you? Settling in okay?', 'What about you?', "You're new here, right? How do you like it?"]);
        this.relDelta({ fam: 3, friend: 2 + n.traits.sociability * 2 });
        llmTopic = true;
        break;
      }
      case id === 'work': {
        this.asked.add('work');
        let biz = null as null | { name: string; street: string; start: number; end: number };
        if (n.job) {
          const d = s.city.businesses[n.job.biz];
          const j = d.jobs[n.job.slot];
          biz = { name: d.name, street: s.city.buildings[d.building].street, start: j.start, end: j.end };
        }
        const openBiz = n.job ? (s.econ.openings(n.job.biz) > 0 ? s.city.businesses[n.job.biz].name : null) : this.nearbyOpening(n);
        reply = L.workLine(r, n, v, biz, openBiz);
        if (openBiz) {
          const bd = s.city.businesses.find((b) => b.name === openBiz);
          if (bd) s.player.flags[`lead_${bd.id}`] = true;
        }
        this.relDelta({ fam: 3, prof: 4, friend: 1 });
        llmTopic = true;
        break;
      }
      case id === 'news': {
        this.asked.add('news');
        const news = s.player.news.filter((x) => s.t - x.t < MIN_PER_DAY * 1.5).map((x) => ({ headline: x.headline, cat: x.cat }));
        // gossip about people they know
        let gossip: string | null = null;
        const rels = [...n.rel.entries()].filter(([, q]) => q.fam > 25);
        r.shuffle(rels);
        for (const [oid] of rels.slice(0, 6)) {
          const o = s.npcs[oid];
          const m = [...o.memories].reverse().find((q) => ['dated_npc', 'lost_job', 'business_closed', 'got_job', 'bought_car', 'promoted', 'argued_npc'].includes(q.type) && s.nsys.strength(q) > 0.15);
          if (m) {
            gossip = L.gossipLine(r, npcName(o), m.type, m.note);
            if (gossip) break;
          }
        }
        reply = L.newsLine(r, news, gossip, s.weather.forecast[0] ?? null);
        this.relDelta({ fam: 2, friend: n.traits.curiosity > 0.5 ? 2 : 1 });
        llmTopic = true;
        break;
      }
      case id === 'needhelp': {
        this.asked.add('needhelp');
        const req = s.jobs?.offerRequest(n);
        if (req) reply = req;
        else reply = v.warm ? "That's sweet of you! I'm all good for now though." : "Nah, I'm fine.";
        this.relDelta({ fam: 2, friend: 2 });
        break;
      }
      case id === 'hang': {
        this.asked.add('hang');
        reply = this.planHangout(n, v);
        break;
      }
      case id === 'day': {
        this.asked.add('day');
        const plan = s.nsys.todaySchedule(n);
        const next = plan.find((p) => p.time > fmtTime(s.dayMinutes));
        reply = next ? `Right now I'm ${s.nsys.describe(n)}. Next up: ${next.what.toLowerCase()} around ${next.time}.` : `Right now I'm ${s.nsys.describe(n)}, then home to sleep.`;
        this.relDelta({ fam: 2 });
        break;
      }
      case id === 'number': {
        const ok = n.relPlayer.friend > 18 + (1 - n.traits.sociability) * 20 && s.nsys.attitude(n) > 0;
        if (ok) {
          n.hasNumber = true;
          if (!s.player.contacts.includes(n.id)) s.player.contacts.push(n.id);
          reply = v.chatty ? "Sure! Text me anytime — I'm terrible at replying though." : 'Sure, here.';
          this.relDelta({ trust: 6, friend: 3 });
          s.notify(`${npcName(n)} added to contacts`, undefined, 'relationship');
          s.objectives?.event('number');
        } else {
          reply = v.blunt ? 'Uh, no.' : "Maybe some other time? I don't really know you yet.";
          this.relDelta({ friend: -1 });
        }
        break;
      }
      case id === 'flirt': {
        this.asked.add('flirt');
        const taken = [...n.rel.values()].some((q) => q.tag === 'partner');
        const attraction = ((n.id * 2654435761) >>> 0) % 100 / 100;
        const success = !taken && attraction > 0.35 && n.relPlayer.friend > 5 && s.nsys.attitude(n) > -0.1;
        reply = L.flirtReaction(r, v, success, taken);
        if (success) {
          this.relDelta({ romance: 6 + n.traits.confidence * 6, friend: 2 });
          s.nsys.addMemory(n, 'player_flirted', [-1], 0.35, 0.6);
        } else {
          this.relDelta({ friend: -3, romance: -2 });
          if (!taken) s.nsys.addMemory(n, 'player_flirted', [-1], 0.3, -0.3);
        }
        break;
      }
      case id === 'sorry': {
        this.asked.add('sorry');
        const forgive = n.traits.kindness * 0.7 + n.traits.patience * 0.3 > 0.45;
        reply = forgive ? r.pick(["...Okay. Apology accepted. Let's start over.", 'Thanks for saying that. It means something.']) : r.pick(["Words are cheap.", "I'll think about it."]);
        this.relDelta(forgive ? { trust: 10, friend: 8, rival: -12 } : { trust: 3 });
        break;
      }
      case id === 'rude': {
        this.asked.add('rude');
        reply = L.insultReaction(r, v);
        this.relDelta({ friend: -14, trust: -10, rival: 12, fam: 2 });
        s.nsys.addMemory(n, 'insulted_by_player', [-1], 0.6, -0.7, n.loc?.k === 'b' ? n.loc.id : undefined);
        s.player.reputation -= 1;
        break;
      }
      case id.startsWith('gift_'): {
        const key = id.slice(5);
        if (key === 'cash') {
          s.player.pay(20, `Gave money to ${npcName(n)}`, s.t, 'cash');
          reply = n.money < 200 ? "Oh wow... thank you. Things have been tight." : r.pick(["Uh, thanks? That's... unexpected.", 'You really don\'t have to do that!']);
          this.relDelta({ friend: n.money < 200 ? 10 : 3, trust: 4 });
          s.nsys.addMemory(n, 'paid_by_player', [-1], 0.45, 0.6);
          n.money += 20;
        } else {
          const it = s.player.inventory.find((i) => i.id === key);
          if (it) {
            s.player.removeItem(it.id);
            const base = it.meta?.gift as string | undefined;
            const love = base ? (GIFT_LOVE[base]?.(n) ?? false) : false;
            reply = L.giftReaction(r, v, it.name.toLowerCase(), love);
            this.relDelta({ friend: love ? 14 : 7, trust: 4, romance: base === 'flowers' ? 4 : 0 });
            s.nsys.addMemory(n, 'gift_from_player', [-1], love ? 0.6 : 0.4, 0.8, undefined, it.name);
            if (it.kind === 'food') n.needs.hunger = Math.min(1, n.needs.hunger + 0.4);
          }
        }
        this.menu = 'main';
        break;
      }
      case id === 'jobs': {
        const lead = this.nearbyOpening(n);
        if (lead) {
          const bd = s.city.businesses.find((b) => b.name === lead)!;
          const b = s.city.buildings[bd.building];
          reply = `${lead} on ${b.street} is hiring. Talk to them inside — I'll mark it for you.`;
          s.setWaypoint(b.door.x, b.door.z, lead);
          s.player.flags[`lead_${bd.id}`] = true;
        } else reply = 'Try the Echo Express courier depot — they always need drivers. And the Jobs app on your phone.';
        this.menu = 'main';
        this.relDelta({ prof: 3, fam: 2 });
        break;
      }
      case id === 'lend': {
        this.asked.add('lend');
        const r2 = n.relPlayer;
        const amount = Math.round(clamp(n.money * 0.05, 20, 120));
        const yes = r2.friend > 35 && n.traits.kindness > 0.4 && n.money > 400;
        if (yes) {
          s.player.earn(amount, `Loan from ${npcName(n)}`, 'cash', s.t);
          n.money -= amount;
          reply = `Okay — here's $${amount}. Pay me back when you can, alright?`;
          s.player.flags[`debt_${n.id}`] = amount;
          this.relDelta({ trust: -4 });
        } else reply = r2.friend > 35 ? "I wish I could, but I'm broke myself." : v.blunt ? "Ha. No." : "Sorry, I don't really lend money to people I barely know.";
        this.menu = 'main';
        break;
      }
      case id.startsWith('dir_'): {
        const d = DIRECTIONS.find((x) => `dir_${x.id}` === id)!;
        const here = s.playerPos();
        let best: number | null = null;
        let bd = Infinity;
        for (const b of s.city.businesses) {
          if (!d.types.includes(b.type)) continue;
          const door = s.city.buildings[b.building].door;
          const dist = Math.hypot(door.x - here.x, door.z - here.z);
          if (dist < bd) {
            bd = dist;
            best = b.id;
          }
        }
        if (best !== null) {
          const b = s.city.businesses[best];
          const door = s.city.buildings[b.building].door;
          const dir = this.cardinal(door.x - here.x, door.z - here.z);
          const blocks = Math.max(1, Math.round(bd / 96));
          reply = `${b.name} — about ${blocks} block${blocks > 1 ? 's' : ''} ${dir}, on ${s.city.buildings[b.building].street}. I'll point you there.`;
          s.setWaypoint(door.x, door.z, b.name);
        } else reply = "Hmm, I can't think of one nearby, sorry.";
        this.menu = 'main';
        this.relDelta({ fam: 2, friend: 1 });
        break;
      }
      case id === 'hang_drink':
      case id === 'hang_talk':
      case id === 'hang_walk': {
        const ap = n.appointment;
        if (id === 'hang_drink') s.player.pay(15, `Drinks with ${npcName(n)}`, s.t);
        reply =
          id === 'hang_talk'
            ? this.lifeTalk(n)
            : id === 'hang_drink'
              ? r.pick(['This is nice. We should do this more often.', "Cheers! To surviving Echo City."])
              : r.pick(['I love walking around here in the evening.', 'Thanks, I needed some fresh air.']);
        const bonus = id === 'hang_drink' ? 14 : 10;
        this.relDelta({ friend: bonus, trust: 8, fam: 10, romance: n.relPlayer.romance > 20 ? 6 : 0 });
        s.nsys.addMemory(n, 'hung_out_with_player', [-1], 0.6, 0.85, ap?.place.k === 'b' ? ap.place.id : undefined);
        if (ap) ap.done = true;
        n.appointment = null;
        n.needs.social = Math.min(1, n.needs.social + 0.4);
        s.objectives?.event('hangout');
        this.menu = 'main';
        break;
      }
      case id === 'bye': {
        reply = L.goodbye(r, v, relStage(n.relPlayer));
        this.say(reply);
        this.publish();
        setTimeout(() => this.end(), 900);
        return;
      }
    }
    if (!reply) reply = '...';
    // optional LLM flavour for small talk
    const cfg = useStore.getState().settings.gameplay;
    if (llmTopic && cfg.llmEnabled) {
      this.thinking = true;
      this.publish();
      const ctx = {
        npc: n,
        occupation: n.title,
        workplace: n.job ? s.city.businesses[n.job.biz].name : null,
        activity: s.nsys.describe(n),
        place: placeName,
        memories: n.memories.slice(-5).map((m) => `${m.type.replace(/_/g, ' ')}${m.note ? ` (${m.note})` : ''}`),
        news: s.player.news.slice(0, 3).map((x) => x.headline),
        weather: s.weather.kind,
        time: s.clock.label(),
        playerName: s.player.name,
      };
      const out = await llmRespond({ enabled: true, endpoint: cfg.llmEndpoint, model: cfg.llmModel }, ctx, opt.label, reply);
      this.thinking = false;
      if (out) reply = out;
      if (!this.target) return;
    }
    this.say(reply);
    s.objectives?.event('talk');
    this.publish();
  }

  private planHangout(n: NPC, v: L.Voice): string {
    const s = this.s;
    const r = n.relPlayer;
    const att = s.nsys.attitude(n);
    if (att < -0.2) return L.hangoutDecline(this.rng, v, 'dislike');
    if (r.friend < 12 - n.traits.sociability * 10) return L.hangoutDecline(this.rng, v, 'stranger');
    if (n.needs.energy < 0.15) return L.hangoutDecline(this.rng, v, 'tired');
    // pick a time: at least 1.5 h from now when they are free
    let t = s.t + 90;
    const sh = s.nsys.shiftToday(n, t);
    if (sh && t < sh.end) t = sh.end + 45;
    const hour = (t % MIN_PER_DAY) / 60;
    if (hour > 22.5 || hour < 7) t = Math.floor(t / MIN_PER_DAY + 1) * MIN_PER_DAY + (n.traits.sociability > 0.6 ? 19 : 12) * 60;
    const h2 = (t % MIN_PER_DAY) / 60;
    const types: BusinessType[] = h2 > 19 ? ['bar', 'restaurant'] : ['cafe', 'restaurant'];
    const home: Place = n.loc ?? s.nsys.homePlace(n);
    const biz = s.nsys.pickVenue(n, types, home, 1200);
    let place: Place;
    let placeName: string;
    if (biz >= 0) {
      place = { k: 'b', id: s.city.businesses[biz].building };
      placeName = s.city.businesses[biz].name;
    } else {
      const o = s.nsys.pickOutdoor(n, home, ['park', 'plaza']);
      if (o < 0) return "Let's figure something out later.";
      place = { k: 'o', id: o };
      placeName = s.city.outdoor[o].name;
    }
    t = Math.round(t / 15) * 15;
    n.appointment = { t, place, with: -1, kind: r.romance > 40 ? 'date' : 'hangout' };
    const timeStr = fmtTime(t % MIN_PER_DAY);
    const dayStr = Math.floor(t / MIN_PER_DAY) > Math.floor(s.t / MIN_PER_DAY) ? 'tomorrow' : 'today';
    s.appointments.push({ npc: n.id, t, place, label: `Meet ${n.first} at ${placeName}` });
    const pos = s.nsys.placePos(place);
    s.notify(`Plans with ${n.first}`, `${placeName}, ${dayStr} at ${timeStr}`, 'relationship');
    s.setWaypoint(pos.x, pos.z, `Meet ${n.first}`);
    this.relDelta({ friend: 3, trust: 3 });
    return L.hangoutAccept(this.rng, v, placeName, `${timeStr} ${dayStr}`);
  }

  private lifeTalk(n: NPC): string {
    const g = n.goal;
    const r = this.rng;
    switch (g.kind) {
      case 'car':
        return `Honestly, I'm saving for a car. I've got about $${Math.round(n.money)} — need around $${g.target}.`;
      case 'job':
        return "I really need a job. It's been rough. If you hear anything, tell me?";
      case 'partner':
        return r.pick(["I'd love to meet someone, you know? It's hard in a big city.", 'Dating here is exhausting. Everyone is so busy.']);
      case 'promotion':
        return "I'm going for a promotion. Working extra hours. Wish me luck.";
      case 'friends':
        return "I don't really have many friends here. That's why this is nice.";
      case 'business':
        return 'One day I want to open my own place. A café, maybe. Somewhere with good light.';
      default:
        return `Just trying to save a bit. Maybe travel someday.`;
    }
  }

  private nearbyOpening(n: NPC): string | null {
    const s = this.s;
    const here = n.loc ?? s.nsys.homePlace(n);
    const id = s.nsys.findOpening(n, here);
    return id >= 0 ? s.city.businesses[id].name : null;
  }

  private cardinal(dx: number, dz: number) {
    const a = Math.atan2(dx, -dz); // 0 = north
    const dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    return dirs[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }

  end() {
    const s = this.s;
    const t = this.target;
    if (!t) return;
    const n = t.npc;
    n.hold = 0;
    t.release();
    // remember the conversation
    const sum = this.lines.length;
    if (sum > 2) {
      const last = [...n.memories].reverse().find((m) => m.type === 'talked_player');
      if (!last || s.t - last.t > 60) s.nsys.addMemory(n, 'talked_player', [-1], 0.22, clamp(s.nsys.attitude(n), -0.5, 0.6));
    }
    this.relDelta({ fam: 2 });
    this.target = null;
    if (s.ctl) s.ctl.forcedPose = null;
    s.game.cam.mode = s.mode === 'vehicle' ? 'vehicle' : 'foot';
    s.game.cam.snap();
    useStore.getState().setOverlay(null);
    useDialogue.getState().set(null);
    s.game.input.requestLock();
  }
}

export type { Memory };
