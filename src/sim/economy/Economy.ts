import type { BusinessDef, BusinessType, CityData } from '../../world/types';
import { DISTRICT_IDS } from '../../world/types';
import { inHours } from '../Clock';
import type { NPC } from '../npc/types';

export interface BizState {
  id: number;
  cash: number;
  stock: number;
  maxStock: number;
  priceMul: number;
  reputation: number;
  revenueToday: number;
  expensesToday: number;
  customersToday: number;
  turnedAway: number;
  employees: number[];
  closed: boolean;
  closedDay: number;
  daysNegative: number;
  owner: 'npc' | 'player';
  history: number[]; // daily profit
  staffPresent: number;
  quality: number; // 0..1 (player upgrades)
  wagePool: number;
}

export interface Txn {
  t: number;
  amount: number;
  label: string;
  account: 'cash' | 'bank';
}

export const BASE_PRICE: Partial<Record<BusinessType, number>> = {
  cafe: 6,
  restaurant: 19,
  fastfood: 9,
  grocery: 38,
  convenience: 7,
  clothing: 48,
  electronics: 140,
  bookstore: 17,
  pharmacy: 14,
  bar: 13,
  nightclub: 24,
  cinema: 13,
  gym: 11,
  salon: 34,
  hotel: 120,
  dealership: 0,
};

const UNIT_COST: Partial<Record<BusinessType, number>> = {
  cafe: 0.32,
  restaurant: 0.36,
  fastfood: 0.35,
  grocery: 0.62,
  convenience: 0.55,
  clothing: 0.45,
  electronics: 0.62,
  bookstore: 0.5,
  pharmacy: 0.5,
  bar: 0.3,
  nightclub: 0.25,
};

const DAILY_RENT: Partial<Record<BusinessType, number>> = {
  cafe: 140,
  restaurant: 260,
  fastfood: 180,
  grocery: 300,
  convenience: 120,
  clothing: 220,
  electronics: 260,
  bookstore: 120,
  pharmacy: 160,
  bar: 180,
  nightclub: 420,
  cinema: 380,
  gym: 220,
  salon: 110,
  hotel: 900,
  office: 520,
  bank: 600,
  dealership: 500,
  warehouse: 380,
  factory: 650,
  depot: 300,
  taxi: 200,
};

/** businesses that earn from contracts/services rather than per-customer sales */
const SERVICE: Partial<Record<BusinessType, true>> = { office: true, factory: true, bank: true, dealership: true, depot: true, taxi: true, salon: true, gym: true, cinema: true };
/** publicly funded: costs are covered by the city budget */
const PUBLIC: Partial<Record<BusinessType, true>> = { school: true, cityhall: true };
const FOOT_TRAFFIC: Record<string, number> = { downtown: 1.1, commercial: 1.15, entertainment: 1.05, residential: 0.92, wealthy: 1.0, industrial: 0.8 };

/** hour-of-day demand shape (roughly mean 1 over opening hours) */
function hourCurve(type: BusinessType, h: number) {
  if (type === 'cafe') return h >= 7 && h < 10 ? 1.45 : h >= 12 && h < 14 ? 1.2 : 0.8;
  if (type === 'restaurant' || type === 'fastfood') return (h >= 12 && h < 14) || (h >= 18 && h < 21) ? 1.5 : 0.7;
  if (type === 'bar' || type === 'nightclub') return h >= 20 || h < 2 ? 1.4 : 0.65;
  if (type === 'grocery' || type === 'convenience') return h >= 16 && h < 20 ? 1.3 : 0.9;
  return 1;
}

export class Economy {
  biz: BizState[] = [];
  /** wholesale price index (supply vs demand) */
  wholesale = 1;
  supplyToday = 0;
  demandToday = 0;
  playerTxns: Txn[] = [];
  gdpToday = 0;
  history: { day: number; gdp: number; unemployment: number; wholesale: number }[] = [];
  onClosure: ((b: BusinessDef) => void) | null = null;
  onOpening: ((b: BusinessDef) => void) | null = null;
  powerOut = new Set<string>(); // district ids
  /** set by the NPC system: people stay in when it pours */
  weather = { rain: 0, storm: 0 };
  /**
   * The 640 simulated residents are a sample of a much bigger city. Everyone else shows up as
   * background demand: proportional to staff on shift (a proxy for size), and shaped by reputation,
   * price, quality, district foot traffic, time of day and weather. Calibrated so a typical,
   * fairly priced business makes a modest profit; bad reputation or overpricing loses money.
   */
  private background(s: BizState, d: BusinessDef, hour: number) {
    if (s.staffPresent <= 0 || PUBLIC[d.type]) return;
    const heads = Math.max(1, d.jobs.reduce((a, j) => a + j.count, 0));
    const wage = d.jobs.length ? d.jobs.reduce((a, j) => a + j.wage * j.count, 0) / heads : 16;
    // staffed hours per day across the week, to spread the rent over
    // (scaled by how many of the positions are actually filled)
    const fill = Math.min(1, Math.max(1, s.employees.length) / heads);
    const staffHours = Math.max(8, fill * d.jobs.reduce((a, j) => a + j.count * (((j.end - j.start + 24) % 24) || 24) * (j.days.length / 7), 0));
    // what one staff-hour has to earn above the cost of goods: wages + 20%, plus its share of the rent
    const margin = 1.2 * wage + (DAILY_RENT[d.type] ?? 150) / staffHours;
    const noise = 0.85 + Math.random() * 0.3;
    const mood = (0.46 + 0.9 * s.reputation) * (0.85 + 0.3 * s.quality) * (FOOT_TRAFFIC[d.district] ?? 1) * (1 - this.weather.rain * 0.12 - this.weather.storm * 0.3) * noise;
    if (SERVICE[d.type]) {
      const rev = s.staffPresent * margin * mood;
      s.cash += rev;
      s.revenueToday += rev;
      this.gdpToday += rev;
      return;
    }
    const base = BASE_PRICE[d.type];
    if (!base) return;
    const unitCost = UNIT_COST[d.type] ?? 0.4;
    // units a staff member sells per hour at a fair price
    const perStaff = margin / (base * (1 - unitCost));
    const elasticity = Math.pow(d.priceLevel * s.priceMul, -1.4);
    const units = s.staffPresent * perStaff * mood * elasticity * hourCurve(d.type, hour);
    const rev = units * this.price(s.id);
    const cogs = units * base * unitCost * this.wholesale;
    s.cash += rev - cogs;
    s.revenueToday += rev;
    s.expensesToday += cogs;
    s.customersToday += Math.round(units);
    this.gdpToday += rev;
    this.demandToday += units * 0.1;
    this.payWholesalers(cogs * 0.1);
  }

  constructor(public city: CityData) {
    for (const b of city.businesses) {
      const base = BASE_PRICE[b.type] ?? 0;
      const maxStock = base > 0 ? (b.type === 'grocery' ? 90 : b.type === 'restaurant' ? 80 : 60) : 0;
      this.biz.push({
        id: b.id,
        cash: 2500 + base * 140,
        stock: maxStock * 0.8,
        maxStock,
        priceMul: 1,
        reputation: 0.6,
        revenueToday: 0,
        expensesToday: 0,
        customersToday: 0,
        turnedAway: 0,
        employees: [],
        closed: false,
        closedDay: -1,
        daysNegative: 0,
        owner: 'npc',
        history: [],
        staffPresent: 0,
        quality: 0.5,
        wagePool: 0,
      });
    }
  }

  attachEmployees(npcs: NPC[]) {
    for (const s of this.biz) s.employees = [];
    for (const n of npcs) if (n.job) this.biz[n.job.biz].employees.push(n.id);
  }

  def(id: number) {
    return this.city.businesses[id];
  }

  isOpen(id: number, hour: number, weekday: number) {
    const s = this.biz[id];
    const d = this.city.businesses[id];
    if (s.closed) return false;
    if (this.powerOut.has(d.district)) return false;
    if (d.type === 'school' || d.type === 'office' || d.type === 'bank' || d.type === 'cityhall') {
      if (weekday >= 5) return false;
    }
    if (d.type === 'nightclub' && weekday < 2) return false;
    return inHours(hour, d.open, d.close);
  }

  price(id: number) {
    const d = this.city.businesses[id];
    const base = BASE_PRICE[d.type] ?? 10;
    return Math.max(1, Math.round(base * d.priceLevel * this.biz[id].priceMul * 100) / 100);
  }

  /** NPC (or player with npc = null) buys from a business. Returns price paid or 0 if failed. */
  purchase(id: number, npc: NPC | null, mult = 1): number {
    const s = this.biz[id];
    const d = this.city.businesses[id];
    if (s.closed) return 0;
    const p = this.price(id) * mult;
    if (s.maxStock > 0 && s.stock < 1) {
      s.turnedAway++;
      s.reputation = Math.max(0.05, s.reputation - 0.004);
      return 0;
    }
    if (npc) {
      if (npc.money < p) return 0;
      npc.money -= p;
    }
    if (s.maxStock > 0) s.stock -= 1 * mult;
    s.cash += p;
    s.revenueToday += p;
    s.customersToday++;
    this.gdpToday += p;
    // understaffing hurts service
    const staffTarget = Math.max(1, d.jobs.reduce((a, j) => a + j.count, 0) * 0.35);
    if (s.staffPresent < staffTarget * 0.5 && npc) s.reputation = Math.max(0.05, s.reputation - 0.002);
    else s.reputation = Math.min(1, s.reputation + 0.0015 * (0.5 + s.quality));
    return p;
  }

  /** wage accrual for an hour of work */
  payWage(npc: NPC, hours: number) {
    if (!npc.job) return;
    const s = this.biz[npc.job.biz];
    const w = npc.wage * hours;
    s.cash -= w;
    s.expensesToday += w;
    npc.money += w;
    this.gdpToday += w * 0.3;
  }

  /** hourly production / restocking */
  hourly(hour: number, weekday: number) {
    for (const s of this.biz) {
      if (s.closed) continue;
      const d = this.city.businesses[s.id];
      if (this.isOpen(s.id, hour, weekday)) this.background(s, d, hour);
      if (d.type === 'warehouse' || d.type === 'factory') {
        // produce goods with present staff
        this.supplyToday += s.staffPresent * (d.type === 'factory' ? 9 : 6);
      }
      // restock in the early morning
      if (s.maxStock > 0 && Math.floor(hour) === 6) {
        const need = s.maxStock - s.stock;
        if (need > 1) {
          const unit = (BASE_PRICE[d.type] ?? 10) * d.priceLevel * (UNIT_COST[d.type] ?? 0.4) * this.wholesale;
          const cost = need * unit;
          s.cash -= cost;
          s.expensesToday += cost;
          s.stock = s.maxStock;
          this.demandToday += need;
          // about half of wholesale goods come from the city's own warehouses and factories
          this.payWholesalers(cost * 0.5);
        }
      }
    }
  }

  private payWholesalers(amount: number) {
    const ind = this.biz.filter((b) => !b.closed && (this.city.businesses[b.id].type === 'warehouse' || this.city.businesses[b.id].type === 'factory'));
    if (!ind.length) return;
    const share = amount / ind.length;
    for (const b of ind) {
      b.cash += share;
      b.revenueToday += share;
    }
  }

  /** end of day accounting; returns notable events */
  daily(day: number, npcs: NPC[]) {
    const events: { kind: 'closure' | 'opening' | 'priceUp' | 'shortage'; biz: number }[] = [];
    // supply & demand → wholesale index
    const ratio = this.demandToday > 0 ? this.supplyToday / this.demandToday : 1.5;
    const target = ratio < 0.8 ? 1.25 : ratio < 1 ? 1.1 : ratio > 1.6 ? 0.9 : 1;
    this.wholesale = Math.round((this.wholesale * 0.7 + target * 0.3) * 1000) / 1000;
    if (ratio < 0.75) events.push({ kind: 'shortage', biz: -1 });
    let unemployed = 0;
    for (const n of npcs) if (!n.job && n.occupation !== 'Retired' && n.occupation !== 'Student') unemployed++;
    this.history.push({ day, gdp: Math.round(this.gdpToday), unemployment: unemployed / Math.max(1, npcs.length), wholesale: this.wholesale });
    if (this.history.length > 30) this.history.shift();
    for (const s of this.biz) {
      if (s.closed) continue;
      const d = this.city.businesses[s.id];
      const rent = DAILY_RENT[d.type] ?? 150;
      s.cash -= rent;
      s.expensesToday += rent;
      if (PUBLIC[d.type]) {
        // the city budget covers schools and city hall
        const budget = s.expensesToday - s.revenueToday;
        s.cash += budget;
        s.revenueToday += budget;
      }
      const profit = s.revenueToday - s.expensesToday;
      s.history.push(Math.round(profit));
      // word of mouth fades: reputation drifts back toward average unless quality keeps it up
      s.reputation += (0.5 + s.quality * 0.2 - s.reputation) * 0.08;
      if (s.history.length > 14) s.history.shift();
      // pricing: sold out -> raise, few customers -> discount
      if (s.maxStock > 0) {
        if (s.turnedAway > 3 || s.stock < s.maxStock * 0.15) s.priceMul = Math.min(1.6, s.priceMul * 1.05);
        else if (s.customersToday < 4) s.priceMul = Math.max(0.7, s.priceMul * 0.97);
        if (this.wholesale > 1.15) s.priceMul = Math.min(1.6, s.priceMul * 1.02);
      }
      // closures for persistent losses (player businesses are protected while they have cash)
      if (s.cash < -1500) s.daysNegative++;
      else s.daysNegative = 0;
      const essential = d.type === 'school' || d.type === 'cityhall' || d.type === 'bank' || d.type === 'depot' || d.type === 'taxi' || d.type === 'dealership';
      if (!essential && s.owner === 'npc' && s.daysNegative >= 4) {
        s.closed = true;
        s.closedDay = day;
        events.push({ kind: 'closure', biz: s.id });
      }
      s.revenueToday = 0;
      s.expensesToday = 0;
      s.customersToday = 0;
      s.turnedAway = 0;
    }
    // reopen closed businesses under new management when the economy is healthy
    for (const s of this.biz) {
      if (!s.closed || s.owner === 'player') continue;
      if (day - s.closedDay >= 3 && unemployed / Math.max(1, npcs.length) > 0.04 && Math.random() < 0.35) {
        s.closed = false;
        s.cash = 4000;
        s.daysNegative = 0;
        s.reputation = 0.55;
        s.priceMul = 0.95;
        events.push({ kind: 'opening', biz: s.id });
      }
    }
    this.gdpToday = 0;
    this.supplyToday = 0;
    this.demandToday = 0;
    return events;
  }

  openings(id: number): number {
    const d = this.city.businesses[id];
    const s = this.biz[id];
    if (s.closed) return 0;
    const total = d.jobs.reduce((a, j) => a + j.count, 0);
    return Math.max(0, total - s.employees.length);
  }

  districtIndex(id: number) {
    return DISTRICT_IDS.indexOf(this.city.businesses[id].district);
  }

  serialize() {
    return { biz: this.biz.map((b) => ({ ...b, employees: [...b.employees], history: [...b.history] })), wholesale: this.wholesale, history: this.history };
  }
  restore(d: ReturnType<Economy['serialize']>) {
    this.biz = d.biz.map((b) => ({ ...b }));
    this.wholesale = d.wholesale;
    this.history = d.history ?? [];
  }
}
