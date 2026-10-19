import type { Session } from './Session';
import type { BusinessDef } from '../world/types';
import { useMiniGame, MiniGameView } from '../state/uiStores';
import { useStore } from '../state/store';
import { RNG } from '../core/rng';
import { formatMoney } from '../core/math';

interface Round {
  prompt: string;
  choices: string[];
  correct: number;
}

type Kind = MiniGameView['kind'];

const DRINKS = ['Latte', 'Cappuccino', 'Americano', 'Flat White', 'Mocha', 'Espresso'];
const MILKS = ['oat milk', 'whole milk', 'almond milk', 'no milk'];
const SIZES = ['small', 'medium', 'large'];

function baristaRound(r: RNG): Round {
  const d = r.pick(DRINKS);
  const m = d === 'Americano' || d === 'Espresso' ? 'no milk' : r.pick(MILKS.slice(0, 3));
  const sz = r.pick(SIZES);
  const answer = `${sz[0].toUpperCase() + sz.slice(1)} ${d}${m !== 'no milk' ? ` · ${m}` : ''}`;
  const set = new Set([answer]);
  while (set.size < 4) {
    const d2 = r.chance(0.5) ? d : r.pick(DRINKS);
    const m2 = d2 === 'Americano' || d2 === 'Espresso' ? 'no milk' : r.pick(MILKS.slice(0, 3));
    const s2 = r.pick(SIZES);
    set.add(`${s2[0].toUpperCase() + s2.slice(1)} ${d2}${m2 !== 'no milk' ? ` · ${m2}` : ''}`);
  }
  const choices = r.shuffle([...set]);
  const name = r.pick(['Maya', 'Omar', 'Lena', 'Jonah', 'Priya', 'Hugo', 'Sana', 'Theo']);
  return { prompt: `${name}: "Can I get a ${sz} ${d.toLowerCase()}${m !== 'no milk' ? ` with ${m}` : ''}, please?"`, choices, correct: choices.indexOf(answer) };
}

function storeRound(r: RNG): Round {
  const items = [
    ['Milk', 2.49],
    ['Bread', 3.1],
    ['Eggs', 4.25],
    ['Coffee', 7.8],
    ['Apples', 2.9],
    ['Pasta', 1.95],
    ['Cheese', 5.4],
  ] as const;
  const a = r.pick(items);
  const b = r.pick(items);
  const total = Math.round((a[1] + b[1]) * 100) / 100;
  const paid = total < 10 ? 10 : 20;
  const change = Math.round((paid - total) * 100) / 100;
  const wrong = new Set<string>([`$${change.toFixed(2)}`]);
  while (wrong.size < 4) wrong.add(`$${Math.max(0.05, change + (r.int(-8, 8) * 0.25 || 0.5)).toFixed(2)}`);
  const choices = r.shuffle([...wrong]);
  return { prompt: `${a[0]} ($${a[1].toFixed(2)}) + ${b[0]} ($${b[1].toFixed(2)}). Customer pays $${paid}. Change?`, choices, correct: choices.indexOf(`$${change.toFixed(2)}`) };
}

function officeRound(r: RNG): Round {
  const cases: [string, string][] = [
    ['"Invoice #4471 is 30 days overdue."', 'Forward to Accounting'],
    ['"Server is down, nobody can log in!"', 'Escalate to IT'],
    ['"Can we move Tuesday\'s meeting to Thursday?"', 'Update the calendar'],
    ['"Congratulations! You won a free cruise!!!"', 'Mark as spam'],
    ['"New hire starts Monday — needs a laptop."', 'Escalate to IT'],
    ['"Client wants the quarterly report today."', 'Reply to the client'],
    ['"Expense receipts for the conference."', 'Forward to Accounting'],
  ];
  const [p, a] = r.pick(cases);
  const opts = ['Forward to Accounting', 'Escalate to IT', 'Update the calendar', 'Mark as spam', 'Reply to the client'];
  const choices = r.shuffle([a, ...r.shuffle(opts.filter((o) => o !== a)).slice(0, 3)]);
  return { prompt: `Email: ${p}`, choices, correct: choices.indexOf(a) };
}

function warehouseRound(r: RNG): Round {
  const zones = ['Zone A · Food', 'Zone B · Electronics', 'Zone C · Fragile', 'Zone D · Bulk'];
  const items: [string, number][] = [
    ['Crate of canned soup', 0],
    ['Box of tablets', 1],
    ['Glass vases (FRAGILE)', 2],
    ['Pallet of cement bags', 3],
    ['Fresh bananas', 0],
    ['Television', 1],
    ['Porcelain plates (FRAGILE)', 2],
    ['Steel pipes', 3],
  ];
  const [it, z] = r.pick(items);
  return { prompt: `Incoming: ${it}`, choices: zones, correct: z };
}

export class MiniGameController {
  private rounds: Round[] = [];
  private i = 0;
  private score = 0;
  private timeLeft = 0;
  private kind: Kind = 'barista';
  private active = false;
  private freelanceMode = false;
  private feedbackT = 0;
  private rng = new RNG(Date.now() & 0xfff);

  constructor(private s: Session) {
    s.updaters.push((dt) => this.update(dt));
  }

  private kindFor(biz: BusinessDef): Kind {
    if (biz.type === 'cafe' || biz.type === 'restaurant' || biz.type === 'fastfood' || biz.type === 'bar' || biz.type === 'nightclub') return 'barista';
    if (biz.type === 'warehouse' || biz.type === 'factory' || biz.type === 'depot') return 'warehouse';
    if (biz.type === 'office' || biz.type === 'bank' || biz.type === 'cityhall' || biz.type === 'hotel' || biz.type === 'taxi') return 'office';
    return 'stock';
  }

  start(biz: BusinessDef) {
    this.freelanceMode = false;
    this.begin(this.kindFor(biz), biz.name);
  }

  freelance() {
    this.freelanceMode = true;
    this.begin('office', 'Freelance gig');
  }

  private begin(kind: Kind, title: string) {
    this.kind = kind;
    const gen = kind === 'barista' ? baristaRound : kind === 'stock' ? storeRound : kind === 'office' ? officeRound : warehouseRound;
    this.rounds = Array.from({ length: 8 }, () => gen(this.rng));
    this.i = 0;
    this.score = 0;
    this.timeLeft = kind === 'stock' ? 9 : 7;
    this.active = true;
    useMiniGame.getState().setAnswer((k) => this.answer(k));
    this.publish(title, null);
    useStore.getState().setOverlay('minigame');
    this.s.game.input.exitLock();
  }

  private titleText() {
    return this.freelanceMode ? 'Freelance gig' : { barista: 'Serve the customers', stock: 'Run the register', office: 'Triage the inbox', warehouse: 'Sort the shipments' }[this.kind];
  }

  private publish(_title: string, feedback: string | null) {
    const r = this.rounds[this.i];
    useMiniGame.getState().set({
      kind: this.kind,
      title: this.titleText(),
      round: this.i + 1,
      rounds: this.rounds.length,
      score: this.score,
      prompt: r?.prompt ?? '',
      choices: r?.choices ?? [],
      timeLeft: this.timeLeft,
      feedback,
    });
  }

  private answer(k: number) {
    if (!this.active || this.feedbackT > 0) return;
    const r = this.rounds[this.i];
    const ok = k === r.correct;
    if (ok) this.score += 1 + Math.min(0.5, this.timeLeft / 14);
    this.s.game.audio.ui(ok ? 'click' : 'warn');
    this.feedbackT = 0.7;
    this.publish('', ok ? 'Nice!' : `Oops — it was "${r.choices[r.correct]}"`);
  }

  private next() {
    this.i++;
    this.timeLeft = this.kind === 'stock' ? 9 : 7;
    if (this.i >= this.rounds.length) return this.finish();
    this.publish('', null);
  }

  private finish() {
    this.active = false;
    const perf = Math.min(1, this.score / (this.rounds.length * 1.25));
    useMiniGame.getState().set(null);
    useStore.getState().setOverlay(null);
    this.s.game.input.requestLock();
    if (this.freelanceMode) {
      const pay = Math.round(40 + perf * 90);
      this.s.skipTime(120, 'Freelancing…', () => {
        this.s.player.earn(pay, 'Freelance gig', 'bank', this.s.t);
        this.s.notify('Gig delivered', `+${formatMoney(pay)}`, 'money');
      });
    } else this.s.jobs?.finishShift(perf);
  }

  cancel() {
    if (!this.active) return;
    this.active = false;
    useMiniGame.getState().set(null);
    useStore.getState().setOverlay(null);
  }

  update(dt: number) {
    if (!this.active) return;
    if (this.feedbackT > 0) {
      this.feedbackT -= dt;
      if (this.feedbackT <= 0) this.next();
      return;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.feedbackT = 0.7;
      this.publish('', 'Too slow!');
      return;
    }
    const v = useMiniGame.getState().view;
    if (v) useMiniGame.getState().set({ ...v, timeLeft: this.timeLeft });
  }
}
