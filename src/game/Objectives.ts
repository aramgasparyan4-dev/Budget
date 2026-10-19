import type { Session } from './Session';
import { relStage } from '../sim/npc/types';
import { formatMoney } from '../core/math';

interface Step {
  text: string;
  sub: string;
  enter?: (s: Session) => void;
  done: (s: Session, ev: string | null) => boolean;
}

export interface LifeGoal {
  id: string;
  title: string;
  desc: string;
  reward: number;
  done: boolean;
  progress: (s: Session) => [number, number];
}

export class Objectives {
  step = 0;
  tutorial = true;
  private look = 0;
  private startPos: { x: number; z: number } | null = null;
  goals: LifeGoal[];
  private steps: Step[];
  private checkTimer = 0;

  constructor(private s: Session) {
    const home = () => s.city.buildings[s.city.playerHome];
    this.steps = [
      {
        text: 'Look around',
        sub: 'Move the mouse (or drag) to turn the camera',
        done: () => this.look > 220,
      },
      {
        text: 'Walk with W A S D',
        sub: 'Hold SHIFT to sprint · SPACE to jump',
        enter: (ss) => {
          const p = ss.playerPos();
          this.startPos = { x: p.x, z: p.z };
        },
        done: (ss) => {
          const p = ss.playerPos();
          return !!this.startPos && Math.hypot(p.x - this.startPos.x, p.z - this.startPos.z) > 10;
        },
      },
      {
        text: 'Go inside your apartment',
        sub: `${home().address} — press E at the door`,
        enter: (ss) => ss.setWaypoint(home().door.x, home().door.z, 'Home'),
        done: (_, ev) => ev === 'enterHome',
      },
      {
        text: 'Check your phone',
        sub: 'Press TAB to open it',
        done: (_, ev) => ev === 'phone',
      },
      {
        text: 'Find work in the Jobs app',
        sub: 'Accept a food delivery to earn your first money',
        done: (_, ev) => ev === 'acceptJob',
      },
      {
        text: 'Complete the delivery',
        sub: 'Follow the marker. Be quick for a better tip',
        done: (_, ev) => ev === 'jobDone',
      },
      {
        text: 'Meet a local',
        sub: 'Walk up to someone and press E to talk',
        done: (_, ev) => ev === 'talk',
      },
      {
        text: 'Earn $500',
        sub: 'Deliveries, taxi shifts, a job, favours for neighbours…',
        done: (ss) => ss.player.money >= 500,
      },
    ];
    const count = (fn: () => number, max: number): [number, number] => [Math.min(max, fn()), max];
    this.goals = [
      { id: 'friend', title: 'Make a friend', desc: 'Become friends with a resident', reward: 100, done: false, progress: (ss) => count(() => ss.npcs.filter((n) => ['Friend', 'Close friend', 'Partner'].includes(relStage(n.relPlayer))).length, 1) },
      { id: 'job', title: 'Get a steady job', desc: 'Apply at a business that is hiring', reward: 150, done: false, progress: (ss) => count(() => (ss.player.job ? 1 : 0), 1) },
      { id: 'contacts', title: 'Build a network', desc: 'Have 5 contacts in your phone', reward: 120, done: false, progress: (ss) => count(() => ss.player.contacts.length, 5) },
      { id: 'hangout', title: 'Social life', desc: 'Make plans with someone and show up', reward: 120, done: false, progress: (ss) => count(() => Number(ss.player.flags.hangouts ?? 0), 1) },
      { id: 'save', title: 'Rainy day fund', desc: 'Have $2,000', reward: 200, done: false, progress: (ss) => count(() => Math.floor(ss.player.money), 2000) },
      { id: 'car', title: 'Wheels of your own', desc: 'Buy a car at Echo Motors', reward: 250, done: false, progress: (ss) => count(() => ss.player.vehicles.length, 1) },
      { id: 'jobs10', title: 'Hustler', desc: 'Complete 10 jobs (deliveries, fares, favours)', reward: 300, done: false, progress: (ss) => count(() => ss.player.stats.deliveries + ss.player.stats.fares + ss.player.stats.requests, 10) },
      { id: 'home', title: 'Moving up', desc: 'Move into a better apartment', reward: 400, done: false, progress: (ss) => count(() => ss.player.homeTier, 1) },
      { id: 'business', title: 'Entrepreneur', desc: 'Buy and run your own business', reward: 1000, done: false, progress: (ss) => count(() => (ss.player.business !== null ? 1 : 0), 1) },
      { id: 'famous', title: 'Local celebrity', desc: 'Reach 25 reputation', reward: 500, done: false, progress: (ss) => count(() => Math.max(0, Math.floor(ss.player.reputation)), 25) },
    ];
  }

  start() {
    this.step = 0;
    this.tutorial = true;
    this.apply();
  }

  skipTutorial() {
    this.tutorial = false;
    this.s.setObjective(null);
  }

  private apply() {
    const st = this.steps[this.step];
    if (!st) return;
    st.enter?.(this.s);
    this.s.setObjective(st.text, st.sub);
  }

  event(ev: string) {
    if (ev === 'hangout') this.s.player.flags.hangouts = Number(this.s.player.flags.hangouts ?? 0) + 1;
    this.check(ev);
  }

  private check(ev: string | null) {
    const s = this.s;
    if (this.tutorial) {
      const st = this.steps[this.step];
      // jobs and dialogue may own the objective line during their own flows
      if (st && st.done(s, ev)) {
        s.game.audio?.ui('notify');
        this.step++;
        if (this.step >= this.steps.length) {
          this.tutorial = false;
          s.notify('Welcome to Echo City', 'Life goals unlocked — check the Goals app on your phone.', 'objective');
          s.setObjective(null);
          s.player.earn(50, 'Welcome bonus · City Hall', 'bank', s.t);
        } else {
          const next = this.steps[this.step];
          // don't overwrite job objectives mid-job
          if (!(s.jobs?.active && this.step > 5)) {
            next.enter?.(s);
            s.setObjective(next.text, next.sub);
          } else next.enter?.(s);
          if (this.step === 6 && !s.jobs?.active) {
            next.enter?.(s);
            s.setObjective(next.text, next.sub);
          }
        }
      }
    }
    for (const g of this.goals) {
      if (g.done) continue;
      const [a, b] = g.progress(s);
      if (a >= b) {
        g.done = true;
        s.player.earn(g.reward, `Goal: ${g.title}`, 'bank', s.t);
        s.player.reputation += 2;
        s.notify(`Goal complete: ${g.title}`, `+${formatMoney(g.reward)}`, 'objective');
      }
    }
  }

  update(dt: number) {
    const s = this.s;
    if (this.tutorial && this.step === 0) this.look += Math.abs(s.game.input.mouseDX) + Math.abs(s.game.input.mouseDY);
    this.checkTimer -= dt;
    if (this.checkTimer <= 0) {
      this.checkTimer = 0.5;
      this.check(null);
      // re-assert tutorial objective if nothing else owns the line
      if (this.tutorial && !s.objective && !s.jobs?.active) this.apply();
    }
  }

  serialize() {
    return { step: this.step, tutorial: this.tutorial, goals: this.goals.filter((g) => g.done).map((g) => g.id) };
  }
  restore(d: ReturnType<Objectives['serialize']>) {
    this.step = d.step;
    this.tutorial = d.tutorial;
    for (const g of this.goals) g.done = d.goals.includes(g.id);
    if (this.tutorial) this.apply();
  }
}
