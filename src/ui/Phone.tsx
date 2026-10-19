import { useEffect, useReducer, useState } from 'react';
import { useStore } from '../state/store';
import { game } from '../game/Game';
import { formatMoney } from '../core/math';
import { fmtDayTime, fmtTime, MIN_PER_DAY } from '../sim/Clock';
import { npcName } from '../sim/npc/Population';
import { relStage, personalitySummary } from '../sim/npc/types';
import { MapCanvas } from './MapView';
import { SettingsPanel } from './Settings';
import { APARTMENT_UPGRADES, HOMES } from '../game/PlayerState';
import { WEATHER_LABEL } from '../sim/Weather';

type App = 'home' | 'maps' | 'contacts' | 'messages' | 'bank' | 'jobs' | 'news' | 'goals' | 'bag' | 'business' | 'calendar' | 'settings' | 'home-shop';

const APPS: { id: App; name: string; icon: string; bg: string }[] = [
  { id: 'maps', name: 'Maps', icon: '🗺️', bg: 'linear-gradient(135deg,#2bb673,#0f6b5a)' },
  { id: 'contacts', name: 'Contacts', icon: '👥', bg: 'linear-gradient(135deg,#7b8cff,#3b3fb8)' },
  { id: 'messages', name: 'Messages', icon: '💬', bg: 'linear-gradient(135deg,#4ce08a,#169c4f)' },
  { id: 'bank', name: 'Bank', icon: '🏦', bg: 'linear-gradient(135deg,#f5c76a,#b9831f)' },
  { id: 'jobs', name: 'Jobs', icon: '💼', bg: 'linear-gradient(135deg,#ff8f5a,#c2410c)' },
  { id: 'news', name: 'News', icon: '📰', bg: 'linear-gradient(135deg,#ff5a6e,#9f1239)' },
  { id: 'goals', name: 'Goals', icon: '🏆', bg: 'linear-gradient(135deg,#57e3d6,#0e7490)' },
  { id: 'bag', name: 'Bag', icon: '🎒', bg: 'linear-gradient(135deg,#c084fc,#6d28d9)' },
  { id: 'calendar', name: 'Calendar', icon: '📅', bg: 'linear-gradient(135deg,#f472b6,#be185d)' },
  { id: 'home-shop', name: 'Home', icon: '🏠', bg: 'linear-gradient(135deg,#94a3b8,#334155)' },
  { id: 'business', name: 'Business', icon: '📈', bg: 'linear-gradient(135deg,#34d399,#047857)' },
  { id: 'settings', name: 'Settings', icon: '⚙️', bg: 'linear-gradient(135deg,#64748b,#1e293b)' },
];

function useTick(ms = 500) {
  const [, f] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(f, ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-2 pb-3">
      <button onClick={onBack} className="text-accent text-sm px-1">
        ‹ Back
      </button>
      <div className="flex-1 text-center font-semibold -ml-12">{title}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 px-1 mb-1.5">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Card({ children, onClick, accent }: { children: React.ReactNode; onClick?: () => void; accent?: string }) {
  return (
    <div onClick={onClick} className={`rounded-2xl bg-white/6 px-3.5 py-3 ${onClick ? 'cursor-pointer hover:bg-white/10' : ''}`} style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        game.audio.ui('click');
        onClick();
      }}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-35 ${primary ? 'bg-accent text-ink' : 'bg-white/10 hover:bg-white/20'}`}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ apps
function JobsApp() {
  useTick();
  const s = game.session!;
  const j = s.jobs!;
  const job = s.player.job;
  const shift = j.shiftStatus();
  return (
    <div className="px-3">
      {j.active && (
        <Section title="Active job">
          <Card accent="#57e3d6">
            <div className="font-semibold text-sm">{j.active.title}</div>
            <div className="text-xs text-white/55 mt-0.5">{j.active.desc}</div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-accent">{Math.ceil(j.active.timer)}s left</span>
              <Btn onClick={() => j.cancel()}>Cancel</Btn>
            </div>
          </Card>
        </Section>
      )}
      {j.taxi && (
        <Section title="Taxi shift">
          <Card accent="#f7c21b">
            <div className="text-sm">Earned {formatMoney(j.taxi.earned)} · {j.taxi.fare ? (j.taxi.fare.stage === 'ride' ? 'passenger aboard' : 'heading to pickup') : 'looking for fares'}</div>
            <div className="mt-2">
              <Btn onClick={() => j.endTaxi()}>End shift</Btn>
            </div>
          </Card>
        </Section>
      )}
      <Section title="Your employment">
        {job ? (
          <Card accent="#7ae582">
            <div className="font-semibold text-sm">{job.role}</div>
            <div className="text-xs text-white/55">
              {s.city.businesses[job.biz].name} · {formatMoney(job.wage)}/h · {fmtTime(job.start * 60)}–{fmtTime((job.end % 24) * 60)}
            </div>
            <div className="text-xs mt-1 text-white/70">
              {shift.label} · {job.shifts} shifts done{job.warnings ? ` · ${job.warnings}/3 warnings` : ''}
            </div>
            <div className="flex gap-2 mt-2">
              <Btn
                onClick={() => {
                  const d = s.city.buildings[s.city.businesses[job.biz].building].door;
                  s.setWaypoint(d.x, d.z, s.city.businesses[job.biz].name);
                }}
              >
                Route to work
              </Btn>
              <Btn onClick={() => j.quit()}>Quit</Btn>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="text-xs text-white/60">No steady job. Businesses that are hiring are marked in Maps — walk in and ask about work.</div>
          </Card>
        )}
      </Section>
      <Section title="Gigs near you">
        {j.available.length === 0 && <div className="text-xs text-white/45 px-1">No gigs right now. Orders come in at meal times.</div>}
        {j.available.map((a) => (
          <Card key={a.id}>
            <div className="flex justify-between">
              <div className="font-semibold text-sm pr-2">{a.title}</div>
              <div className="text-sm font-semibold text-[#7ae582]">{formatMoney(a.pay)}</div>
            </div>
            <div className="text-xs text-white/55 mt-0.5">{a.desc}</div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-[11px] text-white/45">{Math.round(a.limit)}s limit · expires {fmtTime(a.expires % MIN_PER_DAY)}</span>
              <Btn primary disabled={!!j.active} onClick={() => j.accept(a.id)}>
                Accept
              </Btn>
            </div>
          </Card>
        ))}
        <Card>
          <div className="font-semibold text-sm">Echo Cabs · taxi shifts</div>
          <div className="text-xs text-white/55">Visit the Echo Cabs office and press F to take a cab out.</div>
          <div className="mt-2">
            <Btn
              onClick={() => {
                const tb = s.city.landmarks['taxi'];
                if (tb !== undefined) s.setWaypoint(s.city.buildings[tb].door.x, s.city.buildings[tb].door.z, 'Echo Cabs');
              }}
            >
              Route there
            </Btn>
          </div>
        </Card>
      </Section>
      <Section title="Supply runs (buy wholesale, sell to shops)">
        {j.supplies.slice(0, 6).map((sp) => (
          <Card key={sp.biz}>
            <div className="flex justify-between">
              <div className="text-sm pr-2">{s.city.businesses[sp.biz].name}</div>
              <div className="text-sm font-semibold text-[#7ae582]">{formatMoney(sp.price)}</div>
            </div>
            <div className="text-[11px] text-white/50">
              Needs {j.goodsName(sp.goods)} · wholesale {formatMoney(j.wholesalePrice(sp.goods))}
            </div>
            <div className="mt-1.5">
              <Btn
                onClick={() => {
                  const d = s.city.buildings[s.city.businesses[sp.biz].building].door;
                  s.setWaypoint(d.x, d.z, s.city.businesses[sp.biz].name);
                }}
              >
                Mark shop
              </Btn>
            </div>
          </Card>
        ))}
        {j.supplies.length === 0 && <div className="text-xs text-white/45 px-1">Every shop is well stocked today.</div>}
      </Section>
    </div>
  );
}

function ContactsApp() {
  useTick(1000);
  const s = game.session!;
  const [sel, setSel] = useState<number | null>(null);
  const known = s.npcs.filter((n) => n.knowsPlayer || n.relPlayer.fam > 0).sort((a, b) => b.relPlayer.friend + b.relPlayer.fam - (a.relPlayer.friend + a.relPlayer.fam));
  if (sel !== null) {
    const n = s.npcs[sel];
    const r = n.relPlayer;
    const pos = n.trip ? s.nsys.tripPos(n, s.t) : n.loc ? s.nsys.placePos(n.loc) : null;
    return (
      <div className="px-3">
        <button className="text-accent text-sm mb-2" onClick={() => setSel(null)}>
          ‹ All contacts
        </button>
        <div className="text-xl font-semibold">{npcName(n)}</div>
        <div className="text-xs text-white/55">
          {n.title} · {n.age} · {relStage(r)}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {personalitySummary(n.traits).map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10">
              {t}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
          <Card>
            Friendship <b className="float-right">{Math.round(r.friend)}</b>
          </Card>
          <Card>
            Trust <b className="float-right">{Math.round(r.trust)}</b>
          </Card>
          <Card>
            Familiarity <b className="float-right">{Math.round(r.fam)}</b>
          </Card>
          <Card>
            Romance <b className="float-right">{Math.round(r.romance)}</b>
          </Card>
        </div>
        <Section title="Right now">
          <Card>
            <div className="text-sm">{n.hasNumber ? `${n.first} is ${s.nsys.describe(n)}.` : 'You don\'t have their number.'}</div>
            {n.hasNumber && pos && (
              <div className="mt-2">
                <Btn onClick={() => s.setWaypoint(pos.x, pos.z, n.first)}>Locate</Btn>
              </div>
            )}
          </Card>
        </Section>
        <Section title="What they remember about you">
          {s.nsys
            .recall(n, (m) => m.who.includes(-1), 0.02)
            .slice(0, 6)
            .map((m, i) => (
              <div key={i} className="text-xs text-white/70 px-1">
                {m.valence > 0.2 ? '＋' : m.valence < -0.2 ? '－' : '·'} {m.type.replace(/_/g, ' ').replace('player', 'you')} <span className="text-white/35">{fmtDayTime(m.t)}</span>
              </div>
            ))}
        </Section>
      </div>
    );
  }
  return (
    <div className="px-3">
      {known.length === 0 && <div className="text-xs text-white/45 px-1">You haven't met anyone yet. Talk to people on the street with E.</div>}
      {known.slice(0, 40).map((n) => (
        <Card key={n.id} onClick={() => setSel(n.id)}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-semibold">
                {npcName(n)} {n.hasNumber && <span className="text-accent text-[10px] ml-1">📱</span>}
              </div>
              <div className="text-[11px] text-white/50">
                {n.title} · {relStage(n.relPlayer)}
              </div>
            </div>
            <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-[#7ae582]" style={{ width: `${Math.max(3, (n.relPlayer.friend + 100) / 2)}%` }} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function MessagesApp() {
  useTick(1000);
  const s = game.session!;
  const msgs = s.player.messages;
  useEffect(() => {
    for (const m of msgs) m.read = true;
  });
  return (
    <div className="px-3">
      {msgs.length === 0 && <div className="text-xs text-white/45 px-1">No messages yet. Get people's numbers to hear from them.</div>}
      {msgs.map((m) => (
        <Card key={m.id} accent={m.kind === 'invite' ? '#ff8fd8' : m.kind === 'angry' ? '#ff5a6e' : m.kind === 'thanks' ? '#7ae582' : undefined}>
          <div className="flex justify-between">
            <div className="text-sm font-semibold">{m.name}</div>
            <div className="text-[10px] text-white/40">{fmtDayTime(m.t)}</div>
          </div>
          <div className="text-sm text-white/80 mt-0.5">{m.text}</div>
          {m.replies && !m.answered && (
            <div className="flex gap-2 mt-2">
              {m.replies.map((r) => (
                <Btn key={r.label} primary={r.action === 'accept'} onClick={() => s.replyInvite(m.id, r.action === 'accept')}>
                  {r.label}
                </Btn>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function BankApp() {
  useTick(1000);
  const p = game.session!.player;
  return (
    <div className="px-3">
      <div className="rounded-3xl p-5 mb-4" style={{ background: 'linear-gradient(135deg,#1f3b57,#0e1a2a)' }}>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/55">First Echo Bank · Checking</div>
        <div className="text-3xl font-semibold mt-1 tabular-nums">{formatMoney(p.bank, true)}</div>
        <div className="text-xs text-white/55 mt-2">
          Wallet {formatMoney(p.cash, true)} · {p.flags.loan ? 'Loan outstanding $1,800' : 'No loans'}
        </div>
        <div className="text-[11px] text-white/45 mt-1">Rent {formatMoney([210, 480, 1400][p.homeTier])} is charged every Monday.</div>
      </div>
      <Section title="Transactions">
        {p.txns.slice(0, 30).map((t, i) => (
          <div key={i} className="flex justify-between text-xs px-1 py-1 border-b border-white/5">
            <div className="min-w-0 pr-2">
              <div className="truncate text-white/85">{t.label}</div>
              <div className="text-[10px] text-white/35">
                {fmtDayTime(t.t)} · {t.account}
              </div>
            </div>
            <div className={`tabular-nums font-semibold ${t.amount >= 0 ? 'text-[#7ae582]' : 'text-white/80'}`}>
              {t.amount >= 0 ? '+' : ''}
              {formatMoney(t.amount, true)}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function NewsApp() {
  useTick(2000);
  const s = game.session!;
  const econ = s.econ.history[s.econ.history.length - 1];
  return (
    <div className="px-3">
      <Card>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Echo City today</div>
        <div className="text-sm mt-1">
          {WEATHER_LABEL[s.weather.kind]}, {Math.round(s.weather.temp)}°C · later: {s.weather.forecast[0] ? WEATHER_LABEL[s.weather.forecast[0]] : '—'}
        </div>
        {econ && (
          <div className="text-xs text-white/55 mt-1">
            Economy {formatMoney(econ.gdp)} spent yesterday · unemployment {(econ.unemployment * 100).toFixed(1)}% · wholesale index {Math.round(econ.wholesale * 100)}
          </div>
        )}
      </Card>
      <div className="h-3" />
      {s.player.news.length === 0 && <div className="text-xs text-white/45 px-1">Nothing has happened yet. Stay tuned.</div>}
      {s.player.news.map((n) => (
        <Card key={n.id}>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#ffb35a]">
            {n.cat} · {fmtDayTime(n.t)}
          </div>
          <div className="text-sm font-semibold mt-0.5">{n.headline}</div>
          <div className="text-xs text-white/60 mt-0.5">{n.body}</div>
          {n.x !== undefined && (
            <div className="mt-1.5">
              <Btn onClick={() => s.setWaypoint(n.x!, n.z!, n.headline)}>Show on map</Btn>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function GoalsApp() {
  useTick(1000);
  const s = game.session!;
  const o = s.objectives!;
  return (
    <div className="px-3">
      {o.tutorial && (
        <Card accent="#57e3d6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-accent">First day</div>
          <div className="text-sm mt-1">{s.objective?.text ?? 'Keep exploring'}</div>
          <div className="mt-2">
            <Btn onClick={() => o.skipTutorial()}>Skip tutorial</Btn>
          </div>
        </Card>
      )}
      <div className="h-2" />
      {o.goals.map((g) => {
        const [a, b] = g.progress(s);
        return (
          <Card key={g.id} accent={g.done ? '#7ae582' : undefined}>
            <div className="flex justify-between">
              <div className="text-sm font-semibold">{g.done ? '✓ ' : ''}{g.title}</div>
              <div className="text-xs text-[#7ae582]">+{formatMoney(g.reward)}</div>
            </div>
            <div className="text-xs text-white/55">{g.desc}</div>
            <div className="h-1 rounded-full bg-white/10 mt-2 overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${(a / b) * 100}%` }} />
            </div>
          </Card>
        );
      })}
      <Card>
        <div className="text-xs text-white/60">
          Reputation {Math.round(s.player.reputation)} · {s.player.stats.deliveries} deliveries · {s.player.stats.fares} fares · {s.player.stats.shifts} shifts · {formatMoney(s.player.stats.earned)} earned
        </div>
      </Card>
    </div>
  );
}

function BagApp() {
  useTick(800);
  const s = game.session!;
  const p = s.player;
  return (
    <div className="px-3">
      <div className="text-xs text-white/50 px-1 mb-2">
        {p.inventory.length}/{p.capacity} slots · {Number(p.flags.groceries ?? 0)} meals in your fridge
      </div>
      {p.inventory.length === 0 && <div className="text-xs text-white/45 px-1">Your bag is empty.</div>}
      {p.inventory.map((it) => (
        <Card key={it.id}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-semibold">
                {it.name} {it.qty > 1 && <span className="text-white/45">×{it.qty}</span>}
              </div>
              <div className="text-[11px] text-white/45">{it.kind}</div>
            </div>
            <div className="flex gap-1.5">
              {it.kind === 'food' && (
                <Btn
                  onClick={() => {
                    p.removeItem(it.id);
                    p.hunger = Math.min(1, p.hunger + Number(it.meta?.hunger ?? 0.2));
                    p.energy = Math.min(1, p.energy + Number(it.meta?.energy ?? 0));
                    s.objectives?.event('eat');
                  }}
                >
                  Use
                </Btn>
              )}
              {it.kind !== 'delivery' && <Btn onClick={() => p.removeItem(it.id, it.qty)}>Drop</Btn>}
            </div>
          </div>
        </Card>
      ))}
      <Section title="Vehicles">
        {p.vehicles.length === 0 && <div className="text-xs text-white/45 px-1">You don't own a vehicle. Echo Motors sells them.</div>}
        {p.vehicles.map((v) => (
          <Card key={v.vid}>
            <div className="flex justify-between items-center">
              <div className="text-sm">{v.label}</div>
              <div className="flex gap-1.5">
                <Btn onClick={() => s.setWaypoint(s.vehicles.find((x) => x.vid === v.vid)?.pos.x ?? v.x, s.vehicles.find((x) => x.vid === v.vid)?.pos.z ?? v.z, v.label)}>Locate</Btn>
                <Btn
                  disabled={p.money < 40 || s.mode !== 'foot'}
                  onClick={() => {
                    const veh = s.vehicles.find((x) => x.vid === v.vid);
                    const pp = s.playerPos();
                    const spot = s.traffic.findSpot(pp.x, pp.z, 120);
                    if (veh && spot && p.pay(40, 'Vehicle delivery', s.t)) {
                      veh.teleport(spot.x, 0.02, spot.z, spot.rot);
                      s.setWaypoint(spot.x, spot.z, v.label);
                      s.notify('Vehicle delivered', 'It is parked nearby', 'info');
                    }
                  }}
                >
                  Deliver ($40)
                </Btn>
              </div>
            </div>
          </Card>
        ))}
      </Section>
    </div>
  );
}

function CalendarApp() {
  useTick(1000);
  const s = game.session!;
  const job = s.player.job;
  return (
    <div className="px-3">
      <Section title="Plans">
        {s.appointments.length === 0 && <div className="text-xs text-white/45 px-1">No plans. Ask a friend if they want to hang out.</div>}
        {s.appointments.map((a, i) => (
          <Card key={i} accent="#ff8fd8">
            <div className="text-sm font-semibold">{a.label}</div>
            <div className="text-xs text-white/55">{fmtDayTime(a.t)}</div>
            <div className="mt-1.5">
              <Btn
                onClick={() => {
                  const p = s.nsys.placePos(a.place);
                  s.setWaypoint(p.x, p.z, a.label);
                }}
              >
                Route
              </Btn>
            </div>
          </Card>
        ))}
      </Section>
      {job && (
        <Section title="Work schedule">
          <Card>
            <div className="text-sm">{job.role}</div>
            <div className="text-xs text-white/55">
              {job.days.map((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(' ')} · {fmtTime(job.start * 60)}–{fmtTime((job.end % 24) * 60)}
            </div>
          </Card>
        </Section>
      )}
      <Section title="Events today">
        {(s.events?.events ?? []).map((e) => (
          <Card key={e.id}>
            <div className="text-sm">{e.title}</div>
            <div className="text-xs text-white/50">until {fmtTime(e.until % MIN_PER_DAY)}</div>
          </Card>
        ))}
      </Section>
    </div>
  );
}

function HomeApp() {
  useTick(1000);
  const s = game.session!;
  const p = s.player;
  return (
    <div className="px-3">
      <Section title="Your place">
        <Card>
          <div className="text-sm font-semibold">{HOMES[p.homeTier].name}</div>
          <div className="text-xs text-white/55">
            {HOMES[p.homeTier].desc} Rent {formatMoney(HOMES[p.homeTier].rent)}/week.
          </div>
        </Card>
      </Section>
      <Section title="Upgrades (delivered to your apartment)">
        {APARTMENT_UPGRADES.map((u) => {
          const owned = p.upgrades.includes(u.id);
          return (
            <Card key={u.id}>
              <div className="flex justify-between items-center">
                <div className="pr-2">
                  <div className="text-sm">{u.name}</div>
                  <div className="text-[11px] text-white/45">{u.desc}</div>
                </div>
                {owned ? (
                  <span className="text-xs text-accent">Owned</span>
                ) : (
                  <Btn
                    disabled={p.money < u.price}
                    onClick={() => {
                      if (p.pay(u.price, `Furniture: ${u.name}`, s.t)) {
                        p.upgrades.push(u.id);
                        s.notify(`${u.name} delivered`, 'Check it out at home', 'money');
                      }
                    }}
                  >
                    {formatMoney(u.price)}
                  </Btn>
                )}
              </div>
            </Card>
          );
        })}
      </Section>
      <Section title="Move">
        {HOMES.filter((h) => h.tier > p.homeTier).map((h) => (
          <Card key={h.tier}>
            <div className="text-sm font-semibold">{h.name}</div>
            <div className="text-[11px] text-white/50">
              {h.desc} Rent {formatMoney(h.rent)}/week · deposit {formatMoney(h.rent * 2)}
            </div>
            <div className="mt-2">
              <Btn
                disabled={p.money < h.rent * 2}
                onClick={() => {
                  if (p.pay(h.rent * 2, `Deposit: ${h.name}`, s.t)) {
                    p.homeTier = h.tier;
                    s.notify(`Moved into the ${h.name}`, 'Same address, much nicer place', 'objective');
                  }
                }}
              >
                Move in
              </Btn>
            </div>
          </Card>
        ))}
      </Section>
    </div>
  );
}

function BusinessApp() {
  useTick(1000);
  const s = game.session!;
  const bm = s.business!;
  const d = bm.def;
  if (!d) {
    const forSale = s.city.buildings.filter((b) => b.forSale);
    return (
      <div className="px-3">
        <Card>
          <div className="text-sm">You don't own a business yet. Vacant storefronts are for sale around the city.</div>
        </Card>
        <Section title="Properties for sale">
          {forSale.map((b) => (
            <Card key={b.id}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm">{b.address}</div>
                  <div className="text-[11px] text-white/45">{formatMoney(s.interiors!.propertyPrice(b))} + fit-out</div>
                </div>
                <Btn onClick={() => s.setWaypoint(b.door.x, b.door.z, b.address)}>Visit</Btn>
              </div>
            </Card>
          ))}
        </Section>
      </div>
    );
  }
  const st = s.econ.biz[d.id];
  const hist = st.history.slice(-7);
  const max = Math.max(1, ...hist.map((h) => Math.abs(h)));
  return (
    <div className="px-3">
      <div className="rounded-3xl p-5 mb-3" style={{ background: 'linear-gradient(135deg,#065f46,#0b2a22)' }}>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/60">{d.type}</div>
        <div className="text-xl font-semibold">{d.name}</div>
        <div className="text-xs text-white/60 mt-1">
          Today {formatMoney(st.revenueToday)} revenue · {st.customersToday} customers · cash {formatMoney(st.cash)}
        </div>
        <div className="text-xs text-white/60">
          Reputation {Math.round(st.reputation * 100)} · quality {Math.round(st.quality * 100)} · staff {st.employees.length} ({st.staffPresent} on site)
        </div>
      </div>
      <Section title="Daily profit (last 7 days)">
        <div className="flex items-end gap-1 h-20 px-1">
          {hist.length === 0 && <div className="text-xs text-white/45">First day — check back tomorrow.</div>}
          {hist.map((h, i) => (
            <div key={i} className="flex-1 rounded-t" style={{ height: `${(Math.abs(h) / max) * 100}%`, background: h >= 0 ? '#34d399' : '#ff5a6e' }} title={formatMoney(h)} />
          ))}
        </div>
      </Section>
      <Section title="Pricing">
        <div className="flex gap-1.5 flex-wrap">
          {[
            [0.8, 'Budget'],
            [1, 'Standard'],
            [1.25, 'Premium'],
            [1.5, 'Luxury'],
          ].map(([v, l]) => (
            <Btn key={l} primary={Math.abs(d.priceLevel - (v as number)) < 0.01} onClick={() => bm.setPrice(v as number)}>
              {l as string}
            </Btn>
          ))}
        </div>
      </Section>
      <Section title="Invest">
        <div className="flex gap-2">
          <Btn onClick={() => bm.upgrade('quality')}>Renovate ($2,500)</Btn>
          <Btn onClick={() => bm.upgrade('marketing')}>Marketing ($600)</Btn>
        </div>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ shell
export function Phone() {
  const overlay = useStore((s) => s.overlay);
  const app = useStore((s) => s.phoneApp) as App;
  const setApp = useStore((s) => s.setPhoneApp);
  useTick(1000);
  if (overlay !== 'phone' || !game.session) return null;
  const s = game.session;
  const unread = s.player.messages.filter((m) => !m.read).length;
  const title = APPS.find((a) => a.id === app)?.name ?? '';
  // fit short windows: the phone shrinks rather than running off the top of the screen
  const H = Math.max(480, Math.min(720, window.innerHeight - 72));
  return (
    <div className="absolute right-12 bottom-6 pointer-events-auto anim-slide" style={{ width: 380 }}>
      <div className="rounded-[46px] p-3 shadow-2xl" style={{ background: 'linear-gradient(160deg,#2b313b,#0b0e13)', boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.08)' }}>
        <div className="rounded-[36px] overflow-hidden relative" style={{ height: H, background: 'radial-gradient(120% 80% at 20% 0%, #1b3a4b 0%, #0b1018 55%, #07090d 100%)' }}>
          <div className="flex justify-between items-center px-7 pt-3 pb-2 text-xs font-semibold">
            <span>{s.clock.label()}</span>
            <span className="w-24 h-6 rounded-full bg-black absolute left-1/2 -translate-x-1/2 top-2" />
            <span>▮▮▮ 5G ▭</span>
          </div>
          {app === 'home' ? (
            <div className="px-6 pt-6">
              <div className="text-center">
                <div className="text-6xl font-light tabular-nums">{s.clock.label()}</div>
                <div className="text-sm text-white/60 mt-1">
                  {s.clock.weekdayName} · Day {s.clock.day} · {WEATHER_LABEL[s.weather.kind]} {Math.round(s.weather.temp)}°
                </div>
              </div>
              <div className="grid grid-cols-4 gap-y-5 gap-x-3 mt-10">
                {APPS.map((a) => (
                  <button
                    key={a.id}
                    className="flex flex-col items-center gap-1.5 group"
                    onClick={() => {
                      game.audio.ui('click');
                      setApp(a.id);
                      if (a.id === 'messages') for (const m of s.player.messages) m.read = true;
                    }}
                  >
                    <div className="w-14 h-14 rounded-[18px] flex items-center justify-center text-2xl shadow-lg group-hover:scale-105 transition relative" style={{ background: a.bg }}>
                      {a.icon}
                      {a.id === 'messages' && unread > 0 && <span className="absolute -top-1 -right-1 bg-[#ff3b30] text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center">{unread}</span>}
                    </div>
                    <span className="text-[11px] text-white/80">{a.name}</span>
                  </button>
                ))}
              </div>
              <div className="absolute bottom-6 left-0 right-0 text-center text-[11px] text-white/40">TAB to close</div>
            </div>
          ) : (
            <div className="flex flex-col" style={{ height: H - 40 }}>
              <Header title={title} onBack={() => setApp('home')} />
              <div className="flex-1 overflow-y-auto scroll-thin pb-6">
                {app === 'maps' && (
                  <div className="px-3">
                    <MapCanvas height={H - 200} compact />
                  </div>
                )}
                {app === 'contacts' && <ContactsApp />}
                {app === 'messages' && <MessagesApp />}
                {app === 'bank' && <BankApp />}
                {app === 'jobs' && <JobsApp />}
                {app === 'news' && <NewsApp />}
                {app === 'goals' && <GoalsApp />}
                {app === 'bag' && <BagApp />}
                {app === 'calendar' && <CalendarApp />}
                {app === 'home-shop' && <HomeApp />}
                {app === 'business' && <BusinessApp />}
                {app === 'settings' && (
                  <div className="px-3">
                    <SettingsPanel compact />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
