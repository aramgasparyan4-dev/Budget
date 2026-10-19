import type { Session } from './Session';
import type { Building, BusinessDef, BusinessType, InteriorType } from '../world/types';
import { useShop } from '../state/uiStores';
import { useStore } from '../state/store';
import { formatMoney } from '../core/math';

const CONCEPTS: { type: BusinessType; interior: InteriorType; label: string; setup: number; name: (p: string) => string }[] = [
  { type: 'cafe', interior: 'cafe', label: 'Café', setup: 6000, name: (p) => `${p}'s Coffee` },
  { type: 'convenience', interior: 'store', label: 'Corner store', setup: 5000, name: (p) => `${p}'s Corner Shop` },
  { type: 'restaurant', interior: 'restaurant', label: 'Restaurant', setup: 12000, name: (p) => `Chez ${p}` },
  { type: 'bar', interior: 'bar', label: 'Bar', setup: 9000, name: (p) => `${p}'s Tavern` },
  { type: 'clothing', interior: 'clothing', label: 'Boutique', setup: 10000, name: (p) => `${p} Boutique` },
];

export class BusinessManager {
  constructor(private s: Session) {
    s.updaters.push(() => this.tick());
  }
  private lastDay = -1;
  /** the city object is shared between sessions: remember what create() changed so dispose() can undo it */
  private undo: (() => void) | null = null;

  get id() {
    return this.s.player.business;
  }
  get def(): BusinessDef | null {
    return this.id === null ? null : this.s.city.businesses[this.id];
  }

  offerPurchase(b: Building) {
    const s = this.s;
    if (s.player.business !== null) return s.notify('You already own a business', undefined, 'info');
    const property = s.interiors!.propertyPrice(b);
    useShop.getState().set({
      title: `Commercial property · ${b.address}`,
      subtitle: `Property ${formatMoney(property)} + fit-out. Residents will shop here, you hire staff and keep the profit.`,
      items: CONCEPTS.map((c) => ({ id: c.type, name: c.label, price: property + c.setup, desc: `Fit-out ${formatMoney(c.setup)}`, disabled: s.player.bank < property + c.setup ? 'Not enough money in the bank' : undefined })),
      mode: 'buy',
      actions: [],
    });
    useShop.getState().setHandler((id) => {
      const c = CONCEPTS.find((x) => x.type === id)!;
      if (!s.player.pay(property + c.setup, `Business purchase · ${b.address}`, s.t, 'bank')) return;
      this.create(b, c.type, c.interior, c.name(s.player.name));
      useShop.getState().set(null);
      useStore.getState().setOverlay(null);
      s.notify(`${c.name(s.player.name)} is open!`, 'Manage it from the Business app on your phone.', 'objective');
      s.addNews(`New ${c.label.toLowerCase()} opens on ${b.street}`, `${c.name(s.player.name)} is now open at ${b.address}, run by a newcomer to Echo City.`, 'business', b.door);
      s.objectives?.event('business');
    });
    useStore.getState().setOverlay('shop');
    s.game.input.exitLock();
  }

  create(b: Building, type: BusinessType, interior: InteriorType, name: string, restore?: { priceLevel: number }) {
    const s = this.s;
    const city = s.city;
    const id = city.businesses.length;
    const template = city.businesses.find((x) => x.type === type);
    const def: BusinessDef = {
      id,
      name,
      type,
      building: b.id,
      district: b.district,
      jobs: (template?.jobs ?? []).map((j) => ({ ...j, count: Math.max(1, Math.min(2, j.count)) })),
      priceLevel: restore?.priceLevel ?? 1,
      capacity: 18,
      open: template?.open ?? 8,
      close: template?.close ?? 20,
      interior,
      goods: template?.goods ?? 'retail',
    };
    const prev = { businesses: b.businesses, interior: b.interior, forSale: b.forSale, name: b.name, count: city.businesses.length };
    this.undo = () => {
      city.businesses.length = prev.count;
      b.businesses = prev.businesses;
      b.interior = prev.interior;
      b.forSale = prev.forSale;
      b.name = prev.name;
    };
    city.businesses.push(def);
    b.businesses = [id];
    b.interior = interior;
    b.forSale = false;
    b.name = name;
    s.econ.biz.push({
      id,
      cash: 2000,
      stock: 50,
      maxStock: 60,
      priceMul: 1,
      reputation: 0.5,
      revenueToday: 0,
      expensesToday: 0,
      customersToday: 0,
      turnedAway: 0,
      employees: [],
      closed: false,
      closedDay: -1,
      daysNegative: 0,
      owner: 'player',
      history: [],
      staffPresent: 0,
      quality: 0.5,
      wagePool: 0,
    });
    let list = s.nsys.venues.get(type);
    if (!list) s.nsys.venues.set(type, (list = []));
    list.push(id);
    s.player.business = id;
    s.player.flags.businessBuilding = b.id;
    s.player.flags.businessType = type;
    return def;
  }

  setPrice(level: number) {
    const d = this.def;
    if (!d) return;
    d.priceLevel = level;
  }

  upgrade(kind: 'quality' | 'marketing') {
    const s = this.s;
    const id = this.id;
    if (id === null) return;
    const st = s.econ.biz[id];
    const cost = kind === 'quality' ? 2500 : 600;
    if (!s.player.pay(cost, kind === 'quality' ? 'Business renovation' : 'Marketing campaign', s.t, 'bank')) return s.notify('Not enough money', undefined, 'warning');
    if (kind === 'quality') st.quality = Math.min(1, st.quality + 0.15);
    else st.reputation = Math.min(1, st.reputation + 0.12);
    s.notify(kind === 'quality' ? 'Renovated!' : 'Campaign launched', kind === 'quality' ? 'Customers will be happier' : 'More residents will hear about you', 'info');
  }

  /** owner draws profit every morning */
  private tick() {
    const s = this.s;
    const id = this.id;
    if (id === null) return;
    if (s.clock.day === this.lastDay) return;
    const first = this.lastDay < 0;
    this.lastDay = s.clock.day;
    if (first) return;
    const st = s.econ.biz[id];
    const profit = st.history[st.history.length - 1] ?? 0;
    if (st.cash > 1500) {
      const draw = Math.round(st.cash - 1500);
      st.cash -= draw;
      s.player.earn(draw, `Profit · ${this.def!.name}`, 'bank', s.t);
      s.notify(`${this.def!.name}: yesterday ${profit >= 0 ? '+' : ''}${formatMoney(profit)}`, `You withdrew ${formatMoney(draw)}`, 'money');
    } else if (st.cash < 0) {
      const top = Math.round(-st.cash + 500);
      s.player.bank -= top;
      st.cash += top;
      s.notify(`${this.def!.name} lost money`, `You injected ${formatMoney(top)} to cover costs`, 'warning');
    }
    // hire staff from unemployed residents automatically
    const open = s.econ.openings(id);
    if (open > 0) {
      const cand = s.npcs.find((n) => !n.job && n.occupation === 'Unemployed');
      if (cand) {
        s.nsys.hire(cand, id);
        s.notify(`${cand.first} ${cand.last} joined your staff`, this.def!.name, 'info');
      }
    }
  }

  dispose() {
    this.undo?.();
    this.undo = null;
  }

  serialize() {
    const d = this.def;
    if (!d) return null;
    return { building: d.building, type: d.type, interior: d.interior, name: d.name, priceLevel: d.priceLevel };
  }
}
