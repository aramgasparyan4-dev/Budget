import type { HumanLook } from '../../render/Human';
import type { PathPoint } from '../nav/SidewalkNav';

export interface Traits {
  sociability: number;
  ambition: number;
  patience: number;
  confidence: number;
  kindness: number;
  risk: number;
  curiosity: number;
}

export interface Needs {
  hunger: number; // 1 = full
  energy: number;
  social: number;
  fun: number;
}

export interface Rel {
  fam: number; // familiarity 0..100
  friend: number; // -100..100
  trust: number; // -100..100
  romance: number; // 0..100
  rival: number; // 0..100
  prof: number; // professional respect 0..100
  last: number; // last interaction (game minutes)
  tag?: 'partner' | 'family' | 'roommate' | 'coworker' | 'neighbor' | 'friend' | 'boss';
}

export const newRel = (): Rel => ({ fam: 0, friend: 0, trust: 0, romance: 0, rival: 0, prof: 0, last: 0 });

export type MemoryType =
  | 'met_player'
  | 'talked_player'
  | 'helped_by_player'
  | 'insulted_by_player'
  | 'gift_from_player'
  | 'paid_by_player'
  | 'delivery_from_player'
  | 'ride_from_player'
  | 'hit_by_player_car'
  | 'carjacked_by_player'
  | 'stood_up_by_player'
  | 'hung_out_with_player'
  | 'request_done'
  | 'request_failed'
  | 'player_flirted'
  | 'player_calmed_dispute'
  | 'met_npc'
  | 'chat_npc'
  | 'argued_npc'
  | 'dated_npc'
  | 'witnessed_accident'
  | 'stuck_in_traffic'
  | 'late_for_work'
  | 'lost_job'
  | 'got_job'
  | 'promoted'
  | 'visited_business'
  | 'bad_service'
  | 'attended_event'
  | 'power_outage'
  | 'got_wet'
  | 'bought_car'
  | 'business_closed'
  | 'bumped_by_player'
  | 'player_ran_red';

export interface Memory {
  t: number;
  type: MemoryType;
  who: number[]; // npc ids, -1 = player
  place?: number; // building id
  importance: number; // 0..1
  valence: number; // -1..1
  note?: string;
}

export type ActivityKind =
  | 'sleep'
  | 'home'
  | 'work'
  | 'eat'
  | 'eatHome'
  | 'groceries'
  | 'shop'
  | 'social'
  | 'visit'
  | 'leisure'
  | 'nightlife'
  | 'gym'
  | 'cinema'
  | 'jobhunt'
  | 'errand'
  | 'event'
  | 'school'
  | 'appointment'
  | 'drive';

/** b = building, o = outdoor spot */
export interface Place {
  k: 'b' | 'o';
  id: number;
}

export interface Trip {
  from: Place;
  to: Place;
  mode: 'walk' | 'car' | 'bus';
  depart: number;
  arrive: number;
  /** pedestrian path (lazy) */
  path?: PathPoint[];
  pathLen?: number;
  late?: boolean;
}

export interface Activity {
  kind: ActivityKind;
  place: Place;
  until: number;
  started: number;
  biz?: number;
  with?: number; // companion npc / -1 player
}

export interface Goal {
  kind: 'save' | 'car' | 'job' | 'partner' | 'friends' | 'promotion' | 'business' | 'move';
  target: number;
  done: boolean;
}

export interface Appointment {
  t: number; // start game minute
  place: Place;
  with: number; // -1 = player
  kind: 'hangout' | 'date';
  done?: boolean;
  arrived?: boolean;
}

export interface NPC {
  id: number;
  first: string;
  last: string;
  female: boolean;
  age: number;
  occupation: string;
  job: { biz: number; slot: number } | null;
  home: number; // HomeDef id
  traits: Traits;
  look: HumanLook;
  money: number;
  wage: number;
  ownsCar: boolean;
  carType: number;
  carColor: number;
  mood: number; // -1..1
  stress: number; // 0..1
  needs: Needs;
  groceries: number;
  goal: Goal;
  activity: Activity;
  loc: Place | null; // null while travelling
  trip: Trip | null;
  rel: Map<number, Rel>;
  relPlayer: Rel;
  memories: Memory[];
  knowsPlayer: boolean;
  hasNumber: boolean;
  lastUpdate: number;
  wake: number; // hour
  bed: number; // hour
  lateCount: number;
  shiftsWorked: number;
  title: string; // job title incl. promotions
  appointment: Appointment | null;
  favorites: number[]; // business ids
  /** being rendered as a pedestrian/driver right now */
  proxy: 'none' | 'ped' | 'car' | 'interior';
  /** seconds of real time the npc is held (talking to player) */
  hold: number;
  lastTalk: number;
  requestOpen: boolean;
  fired?: boolean;
  wealth: number; // 0..1 lifestyle
}

export interface PersonalityLabel {
  key: keyof Traits;
  high: string;
  low: string;
}
export const TRAIT_LABELS: PersonalityLabel[] = [
  { key: 'sociability', high: 'Outgoing', low: 'Reserved' },
  { key: 'ambition', high: 'Ambitious', low: 'Laid-back' },
  { key: 'patience', high: 'Patient', low: 'Impatient' },
  { key: 'confidence', high: 'Confident', low: 'Shy' },
  { key: 'kindness', high: 'Kind', low: 'Blunt' },
  { key: 'risk', high: 'Daring', low: 'Cautious' },
  { key: 'curiosity', high: 'Curious', low: 'Routine-loving' },
];

export function personalitySummary(t: Traits): string[] {
  const out: { label: string; w: number }[] = [];
  for (const l of TRAIT_LABELS) {
    const v = t[l.key];
    if (v > 0.66) out.push({ label: l.high, w: v - 0.5 });
    else if (v < 0.34) out.push({ label: l.low, w: 0.5 - v });
  }
  out.sort((a, b) => b.w - a.w);
  return out.slice(0, 3).map((o) => o.label);
}

export function relStage(r: Rel): string {
  if (r.romance > 70 && r.friend > 50) return 'Partner';
  if (r.rival > 55 && r.friend < 0) return 'Rival';
  if (r.friend > 70) return 'Close friend';
  if (r.friend > 38) return 'Friend';
  if (r.friend < -35) return 'Dislikes you';
  if (r.fam > 22) return 'Acquaintance';
  if (r.fam > 0) return 'Met once';
  return 'Stranger';
}
