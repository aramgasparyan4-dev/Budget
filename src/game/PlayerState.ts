import * as THREE from 'three';
import type { HumanLook } from '../render/Human';
import type { Txn } from '../sim/economy/Economy';

export type ItemKind = 'food' | 'gift' | 'goods' | 'delivery' | 'misc' | 'clothing';

export interface Item {
  id: string;
  name: string;
  qty: number;
  kind: ItemKind;
  value: number;
  /** food: hunger restored; delivery: job id */
  meta?: Record<string, number | string>;
}

export interface Message {
  id: number;
  from: number; // npc id, -1 = system, -2 = employer
  name: string;
  text: string;
  t: number;
  read: boolean;
  kind: 'invite' | 'thanks' | 'angry' | 'chat' | 'request' | 'news' | 'system' | 'job';
  replies?: { label: string; action: string }[];
  answered?: boolean;
}

export interface NewsItem {
  id: number;
  t: number;
  headline: string;
  body: string;
  cat: string;
  x?: number;
  z?: number;
}

export interface OwnedVehicle {
  vid: number;
  type: number;
  color: number;
  x: number;
  z: number;
  yaw: number;
  label: string;
}

export interface PlayerJob {
  biz: number;
  role: string;
  wage: number;
  start: number;
  end: number;
  days: number[];
  shifts: number;
  late: number;
  lastShiftDay: number;
  warnings: number;
}

export interface Outfit {
  id: string;
  name: string;
  shirt: number;
  pants: number;
  style: 'casual' | 'business' | 'sport' | 'luxury' | 'work';
  owned: boolean;
}

export const OUTFITS: (Outfit & { price: number })[] = [
  { id: 'starter', name: 'Thrift Hoodie', shirt: 0x6b4e3d, pants: 0x2b2f38, style: 'casual', owned: true, price: 0 },
  { id: 'denim', name: 'Denim & Tee', shirt: 0xe9e6df, pants: 0x34507a, style: 'casual', owned: false, price: 65 },
  { id: 'sport', name: 'Track Set', shirt: 0x1f6fd1, pants: 0x1c1c22, style: 'sport', owned: false, price: 90 },
  { id: 'work', name: 'Hi-Vis Workwear', shirt: 0xf0a020, pants: 0x3a3a3a, style: 'work', owned: false, price: 55 },
  { id: 'smart', name: 'Smart Casual', shirt: 0x6f8fa8, pants: 0x3d3830, style: 'business', owned: false, price: 160 },
  { id: 'suit', name: 'Charcoal Suit', shirt: 0x2a2c33, pants: 0x24262c, style: 'business', owned: false, price: 420 },
  { id: 'designer', name: 'Designer Jacket', shirt: 0x7b1f2e, pants: 0x101012, style: 'luxury', owned: false, price: 1250 },
];

export const APARTMENT_UPGRADES = [
  { id: 'bed', name: 'Memory Foam Bed', price: 380, desc: 'Sleep restores energy 40% faster.' },
  { id: 'tv', name: 'Smart TV', price: 520, desc: 'Watch the news at home. +Fun when relaxing.' },
  { id: 'kitchen', name: 'Kitchen Set', price: 640, desc: 'Cook meals at home from groceries.' },
  { id: 'pc', name: 'Workstation PC', price: 900, desc: 'Take freelance gigs from home.' },
  { id: 'decor', name: 'Plants & Art', price: 260, desc: 'Friends visiting are more impressed.' },
];

export const HOMES = [
  { tier: 0, name: 'Studio, Apt 3B', rent: 210, desc: 'A small studio with a view of the alley.' },
  { tier: 1, name: 'One-bedroom Loft', rent: 480, desc: 'Brighter, bigger, a proper kitchen.' },
  { tier: 2, name: 'Harbor View Penthouse', rent: 1400, desc: 'Floor-to-ceiling windows over the bay.' },
];

let msgId = 1;
let newsId = 1;

export class PlayerState {
  name = 'Alex';
  look!: HumanLook;
  cash = 250;
  bank = 0;
  txns: Txn[] = [];
  hunger = 0.8;
  energy = 0.9;
  inventory: Item[] = [];
  capacity = 8;
  vehicles: OwnedVehicle[] = [];
  outfits: Outfit[] = OUTFITS.map((o) => ({ ...o }));
  outfit = 'starter';
  upgrades: string[] = [];
  homeTier = 0;
  job: PlayerJob | null = null;
  business: number | null = null;
  contacts: number[] = [];
  messages: Message[] = [];
  news: NewsItem[] = [];
  reputation = 0;
  stats = { deliveries: 0, fares: 0, earned: 0, shifts: 0, requests: 0, walked: 0, driven: 0, trades: 0 };
  flags: Record<string, boolean | number | string> = {};
  rentDueDay = 8;
  onMoney: ((delta: number, label: string) => void) | null = null;

  get money() {
    return this.cash + this.bank;
  }

  earn(amount: number, label: string, account: 'cash' | 'bank', t: number) {
    amount = Math.round(amount * 100) / 100;
    if (account === 'cash') this.cash += amount;
    else this.bank += amount;
    this.txns.unshift({ t, amount, label, account });
    if (this.txns.length > 120) this.txns.pop();
    if (amount > 0) this.stats.earned += amount;
    this.onMoney?.(amount, label);
  }

  /** pay using cash first, then card (bank) */
  pay(amount: number, label: string, t: number, prefer: 'cash' | 'bank' | 'any' = 'any'): boolean {
    amount = Math.round(amount * 100) / 100;
    if (this.money < amount) return false;
    if (prefer === 'bank' && this.bank >= amount) {
      this.bank -= amount;
      this.txns.unshift({ t, amount: -amount, label, account: 'bank' });
    } else if (this.cash >= amount && prefer !== 'bank') {
      this.cash -= amount;
      this.txns.unshift({ t, amount: -amount, label, account: 'cash' });
    } else {
      const fromCash = Math.min(this.cash, amount);
      const fromBank = amount - fromCash;
      if (fromBank > this.bank) return false;
      this.cash -= fromCash;
      this.bank -= fromBank;
      if (fromCash > 0) this.txns.unshift({ t, amount: -fromCash, label, account: 'cash' });
      if (fromBank > 0) this.txns.unshift({ t, amount: -fromBank, label, account: 'bank' });
    }
    if (this.txns.length > 120) this.txns.length = 120;
    this.onMoney?.(-amount, label);
    return true;
  }

  addItem(item: Omit<Item, 'qty'> & { qty?: number }): boolean {
    const ex = this.inventory.find((i) => i.id === item.id && i.kind !== 'delivery');
    if (ex) {
      ex.qty += item.qty ?? 1;
      return true;
    }
    if (this.inventory.length >= this.capacity) return false;
    this.inventory.push({ qty: 1, ...item } as Item);
    return true;
  }
  removeItem(id: string, qty = 1) {
    const i = this.inventory.findIndex((x) => x.id === id);
    if (i < 0) return false;
    this.inventory[i].qty -= qty;
    if (this.inventory[i].qty <= 0) this.inventory.splice(i, 1);
    return true;
  }
  has(id: string) {
    return this.inventory.some((i) => i.id === id);
  }

  message(m: Omit<Message, 'id' | 'read'>) {
    const msg: Message = { ...m, id: msgId++, read: false };
    this.messages.unshift(msg);
    if (this.messages.length > 80) this.messages.pop();
    return msg;
  }

  addNews(n: Omit<NewsItem, 'id'>) {
    const item = { ...n, id: newsId++ };
    this.news.unshift(item);
    if (this.news.length > 60) this.news.pop();
    return item;
  }

  serialize() {
    return {
      name: this.name,
      look: {
        shirt: this.look.shirt.getHex(),
        pants: this.look.pants.getHex(),
        skin: this.look.skin.getHex(),
        hair: this.look.hair.getHex(),
        hairStyle: this.look.hairStyle,
        build: this.look.build,
        height: this.look.height,
      },
      cash: this.cash,
      bank: this.bank,
      txns: this.txns.slice(0, 60),
      hunger: this.hunger,
      energy: this.energy,
      inventory: this.inventory,
      capacity: this.capacity,
      vehicles: this.vehicles,
      outfits: this.outfits.map((o) => ({ id: o.id, owned: o.owned })),
      outfit: this.outfit,
      upgrades: this.upgrades,
      homeTier: this.homeTier,
      job: this.job,
      business: this.business,
      contacts: this.contacts,
      messages: this.messages.slice(0, 40),
      news: this.news.slice(0, 30),
      reputation: this.reputation,
      stats: this.stats,
      flags: this.flags,
      rentDueDay: this.rentDueDay,
    };
  }

  restore(d: ReturnType<PlayerState['serialize']>) {
    this.name = d.name;
    this.look = {
      shirt: new THREE.Color(d.look.shirt),
      pants: new THREE.Color(d.look.pants),
      skin: new THREE.Color(d.look.skin),
      hair: new THREE.Color(d.look.hair),
      hairStyle: d.look.hairStyle,
      build: d.look.build,
      height: d.look.height,
      seed: this.look?.seed ?? 0.5,
    };
    this.cash = d.cash;
    this.bank = d.bank;
    this.txns = d.txns;
    this.hunger = d.hunger;
    this.energy = d.energy;
    this.inventory = d.inventory.filter((i) => i.kind !== 'delivery');
    this.capacity = d.capacity;
    this.vehicles = d.vehicles;
    for (const o of this.outfits) o.owned = o.owned || d.outfits.some((x) => x.id === o.id && x.owned);
    this.outfit = d.outfit;
    this.upgrades = d.upgrades;
    this.homeTier = d.homeTier;
    this.job = d.job;
    this.business = d.business;
    this.contacts = d.contacts;
    this.messages = d.messages;
    this.news = d.news;
    this.reputation = d.reputation;
    this.stats = { ...this.stats, ...d.stats };
    this.flags = d.flags;
    this.rentDueDay = d.rentDueDay;
    // keep id counters ahead of restored ids
    for (const m of this.messages) msgId = Math.max(msgId, m.id + 1);
    for (const n of this.news) newsId = Math.max(newsId, n.id + 1);
  }
}
