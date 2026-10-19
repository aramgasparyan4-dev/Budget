// Procedural dialogue text. Every function picks phrasing that reflects the
// speaker's personality, mood, relationship with the player and memories.
import type { RNG } from '../../core/rng';
import type { NPC, Memory } from '../npc/types';

export interface Voice {
  warm: boolean; // kind + sociable
  shy: boolean;
  blunt: boolean;
  chatty: boolean;
  confident: boolean;
  grumpy: boolean; // bad mood
  cheerful: boolean; // good mood
  formal: boolean; // older / business
}

export function voiceOf(n: NPC): Voice {
  const t = n.traits;
  return {
    warm: t.kindness > 0.6 && t.sociability > 0.45,
    shy: t.confidence < 0.32,
    blunt: t.kindness < 0.33,
    chatty: t.sociability > 0.68,
    confident: t.confidence > 0.68,
    grumpy: n.mood < -0.3,
    cheerful: n.mood > 0.35,
    formal: n.age > 58 || /Manager|Advisor|Lawyer|Pharmacist|Planner/.test(n.title),
  };
}

const pick = <T,>(r: RNG, a: T[]) => a[Math.floor(r.next() * a.length) % a.length];

export function opener(r: RNG, v: Voice): string {
  if (v.shy) return pick(r, ['Um... ', 'Oh! ', 'Uh, ', '']);
  if (v.chatty && v.cheerful) return pick(r, ['Oh hey! ', 'Hey hey! ', 'Well hello! ']);
  if (v.blunt || v.grumpy) return pick(r, ['', 'Look, ', 'Yeah? ']);
  if (v.formal) return pick(r, ['Ah, ', 'Well, ', '']);
  return pick(r, ['', 'Oh, ', 'Hey, ']);
}

export function greetStranger(r: RNG, n: NPC, v: Voice, hour: number): string {
  const tod = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  if (v.grumpy && v.blunt) return pick(r, ["Can I help you?", "Do I know you?", "What is it? I'm kind of busy."]);
  if (v.shy) return pick(r, ['Oh — hi. Did you... need something?', 'Um, hello?', 'Hi... sorry, do we know each other?']);
  if (v.chatty) return pick(r, [`Good ${tod}! Don't think I've seen you around before.`, `Hey there! Lovely ${tod}, isn't it?`, `Hi! You look a little lost — new in town?`]);
  if (v.formal) return pick(r, [`Good ${tod}.`, `Good ${tod}. Can I help you with something?`]);
  return pick(r, [`Hi there.`, `Hey. What's up?`, `Hello!`, `Good ${tod}.`]);
}

export function greetKnown(r: RNG, n: NPC, v: Voice, stage: string, playerName: string): string {
  const nm = r.chance(0.5) ? `, ${playerName}` : '';
  if (stage === 'Partner') return pick(r, [`There you are${nm}! I was just thinking about you.`, `Hey you${nm}. Missed you.`]);
  if (stage === 'Close friend') return pick(r, [`${playerName}! My favourite person in this city.`, `Hey${nm}! Perfect timing, I could use some company.`]);
  if (stage === 'Friend') return pick(r, [`Hey${nm}! Good to see you.`, `Oh nice, it's you${nm}!`, `Hey${nm}, how's it going?`]);
  if (stage === 'Rival' || stage === 'Dislikes you') return pick(r, ['Oh. You.', 'What do you want now?', "Great. Just who I didn't want to see.", 'Make it quick.']);
  if (stage === 'Acquaintance') return pick(r, [`Oh, hi${nm}.`, `Hey — ${playerName}, right?`, `Hi again${nm}.`]);
  return pick(r, ['Oh, hello again.', 'Hi again.', 'You again! Hi.']);
}

/** A line reacting to the strongest relevant memory involving the player. */
export function memoryLine(r: RNG, m: Memory, placeName: string | null): string | null {
  const at = placeName ? ` at ${placeName}` : '';
  switch (m.type) {
    case 'hit_by_player_car':
      return pick(r, ["You're the maniac who ran me over! I still have the bruises.", "Stay away from me. You hit me with your car!", "I remember you. You nearly killed me on the street."]);
    case 'carjacked_by_player':
      return pick(r, ['YOU. You stole my car! I should call the police.', "You've got some nerve, talking to me after taking my car."]);
    case 'bumped_by_player':
      return pick(r, ['You crashed into my car the other day. The repair bill was not cheap.', "Learn to drive, will you? You rear-ended me."]);
    case 'stood_up_by_player':
      return pick(r, [`I waited for you${at}. You never showed.`, `Oh, NOW you show up? I sat${at} for an hour.`]);
    case 'insulted_by_player':
      return pick(r, ["I haven't forgotten what you said to me.", 'After last time? I am surprised you came back.']);
    case 'helped_by_player':
    case 'request_done':
      return pick(r, ['Thanks again for helping me out. Seriously.', "I still owe you one for last time.", 'My hero! That really saved me.']);
    case 'delivery_from_player':
      return pick(r, ['You did my delivery the other day! Fastest I have ever gotten food.', 'Hey, the courier! Thanks for the delivery.']);
    case 'ride_from_player':
      return pick(r, ['Thanks for the ride the other day.', 'Hey, my favourite driver!']);
    case 'gift_from_player':
      return pick(r, ['I still love the gift you gave me.', 'That gift was so thoughtful, by the way.']);
    case 'hung_out_with_player':
      return pick(r, [`That was fun${at} last time.`, 'We should do that again sometime.']);
    case 'paid_by_player':
      return pick(r, ['I have not forgotten that money you lent me.', 'Thanks again for helping me out with cash.']);
    case 'player_calmed_dispute':
      return pick(r, ['Thanks for stepping in during that argument.', 'You handled that fight really well.']);
    case 'player_flirted':
      return m.valence > 0 ? pick(r, ['So... you again. *smiles*', "I've been hoping I'd run into you."]) : pick(r, ['About what you said last time... let\'s keep things friendly.']);
    case 'witnessed_accident':
      return pick(r, ["Weren't you the one in that crash? Crazy scene.", 'I saw that accident. Was that you?']);
    case 'player_ran_red':
      return pick(r, ['I saw what you did. Not cool.', "Aren't you the one who took that car?"]);
    default:
      return null;
  }
}

export function moodLine(r: RNG, n: NPC, v: Voice, ctx: { work: string | null; recent: Memory | null; rain: boolean; tired: boolean; hungry: boolean; hour: number; recentName: string | null }): string {
  const rec = ctx.recent;
  if (rec) {
    const nm = ctx.recentName ?? 'someone';
    switch (rec.type) {
      case 'got_job':
        return pick(r, [`Honestly? Great. I just got a job at ${rec.note ?? 'a new place'}!`, `I'm on top of the world — new job at ${rec.note}.`]);
      case 'lost_job':
      case 'business_closed':
        return pick(r, [`Not good. ${rec.note ?? 'My work'}... I lost my job.`, `Rough week. ${rec.note}. I'm looking for work now.`]);
      case 'promoted':
        return pick(r, [`Really good! I just got promoted — ${rec.note}.`, `I got a promotion! Drinks are on me... well, maybe.`]);
      case 'bought_car':
        return pick(r, [`Amazing, actually — I finally bought a ${rec.note}!`, `I just picked up my new ${rec.note}. Saved for months.`]);
      case 'dated_npc':
        return pick(r, [`I'm kind of floating, honestly. I've been seeing ${nm}.`, `Things are good. Really good. ${nm} and I are a thing now.`]);
      case 'argued_npc':
        return pick(r, [`Annoyed. I had a fight with ${nm} earlier.`, `Ugh. ${nm} and I got into it today.`]);
      case 'late_for_work':
        return pick(r, ['Stressed. I was late for work again.', 'My boss gave me a look this morning. I was late.']);
      case 'stuck_in_traffic':
        return pick(r, ['The traffic this morning was brutal.', 'Spent half the morning stuck in traffic. This city!']);
      case 'bad_service':
        return pick(r, [`Grumpy. ${rec.note ?? 'That place'} was out of everything when I went.`, `Meh. ${rec.note} let me down today.`]);
      case 'got_wet':
        return 'Soaked, thanks. I got caught in the rain.';
      case 'attended_event':
        return pick(r, [`Great! I was just at ${rec.note ?? 'the gathering'}. Such a vibe.`]);
    }
  }
  if (ctx.tired) return pick(r, ['Exhausted. I could sleep for a week.', "Tired. Long day and it's not over."]);
  if (ctx.hungry) return pick(r, ["Starving, honestly. I haven't eaten since this morning.", 'Hungry! I need lunch.']);
  if (ctx.rain) return pick(r, ['Damp. Why does it always rain when I forget my umbrella?', 'This rain, huh? Ruins everything.']);
  if (v.cheerful) return pick(r, ["Can't complain! The city's good to me lately.", 'Pretty great, actually. Thanks for asking!', 'Good! Really good.']);
  if (v.grumpy) return pick(r, ["Honestly? Not my best day.", "Don't ask.", 'Could be better. Could be a lot better.']);
  if (ctx.work) return pick(r, [`Fine. Busy with work at ${ctx.work}.`, `Alright. Just trying to get through the week at ${ctx.work}.`]);
  return pick(r, ['Fine, thanks. You?', 'Not bad. Same old.', 'Okay, I guess.']);
}

export function workLine(r: RNG, n: NPC, v: Voice, biz: { name: string; street: string; start: number; end: number } | null, hiring: string | null): string {
  if (!biz) {
    if (n.occupation === 'Retired') return pick(r, ['Retired! I put in my forty years. Now I feed pigeons and complain about traffic.', "I'm retired. I used to work down at the docks."]);
    if (n.occupation === 'Student') return pick(r, ['I\'m a student. Exams are killing me.', "Still studying. Don't ask what I want to do after."]);
    if (n.occupation === 'Freelancer') return pick(r, ['I freelance — design, writing, whatever pays. Lots of cafés.', 'Freelance. My office is whichever café has the best wifi.']);
    return hiring
      ? pick(r, [`Between jobs right now. I heard ${hiring} is hiring, might try there.`, `Looking. If you hear of anything... ${hiring} has openings, apparently.`])
      : pick(r, ["I'm between jobs at the moment.", 'Unemployed. It is not as fun as it sounds.']);
  }
  const hours = `${fmtH(biz.start)} to ${fmtH(biz.end)}`;
  const pre = v.formal ? `I'm a ${n.title} at ${biz.name}` : `I work at ${biz.name} — ${n.title}`;
  const opinion = n.traits.ambition > 0.65
    ? pick(r, [" I'm aiming for a promotion this year.", ' I want to run the place one day.'])
    : n.mood < -0.2
      ? pick(r, [' The pay could be better.', ' Some days I wonder why I bother.'])
      : pick(r, [' It\'s alright.', ' Good people there.', '']);
  const where = r.chance(0.5) ? ` on ${biz.street}` : '';
  const sched = r.chance(0.6) ? ` Usually ${hours}.` : '';
  const hire = hiring && r.chance(0.6) ? ` We're actually hiring, if you're looking.` : '';
  return `${pre}${where}.${sched}${opinion}${hire}`;
}

function fmtH(h: number) {
  const hh = Math.floor(h) % 24;
  const ap = hh >= 12 ? 'pm' : 'am';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}${ap}`;
}

export function newsLine(r: RNG, items: { headline: string; cat: string }[], gossip: string | null, weatherNext: string | null): string {
  const parts: string[] = [];
  if (items.length) {
    const it = items[Math.floor(r.next() * Math.min(3, items.length))];
    parts.push(pick(r, [`Did you hear? ${it.headline}.`, `Apparently: ${it.headline}.`, `Everyone's talking about it — ${it.headline.toLowerCase()}.`]));
  }
  if (gossip) parts.push(gossip);
  if (!parts.length && weatherNext) parts.push(`Not much. Supposed to be ${weatherNext.toLowerCase()} later, though.`);
  if (!parts.length) parts.push(pick(r, ['Quiet around here lately. Too quiet.', "Nothing much. Same city, same traffic.", 'Not a lot. Rent keeps going up, that\'s news.']));
  return parts.join(' ');
}

export function gossipLine(r: RNG, about: string, what: Memory['type'], note?: string): string | null {
  switch (what) {
    case 'dated_npc':
      return pick(r, [`And between us — ${about} is seeing someone new!`, `Oh, and ${about} has a new partner. Finally.`]);
    case 'lost_job':
    case 'business_closed':
      return `Poor ${about} lost their job${note ? ` (${note})` : ''}.`;
    case 'got_job':
      return `${about} just started at ${note ?? 'a new place'}.`;
    case 'bought_car':
      return `${about} bought a ${note ?? 'car'} — won't shut up about it.`;
    case 'argued_npc':
      return `${about} got into a big argument the other day.`;
    case 'promoted':
      return `${about} got promoted, can you believe it?`;
    default:
      return null;
  }
}

export function hangoutAccept(r: RNG, v: Voice, place: string, time: string) {
  if (v.chatty) return pick(r, [`Yes! Let's do ${place} at ${time}. Don't be late!`, `Oh I'd love that. ${place}, ${time}?`]);
  if (v.shy) return pick(r, [`Oh... sure, okay. ${place} at ${time}?`, `I'd like that. Maybe ${place}, around ${time}?`]);
  return pick(r, [`Sure. ${place}, ${time}?`, `Sounds good — meet you at ${place} at ${time}.`]);
}
export function hangoutDecline(r: RNG, v: Voice, reason: 'stranger' | 'dislike' | 'busy' | 'tired', busyUntil?: string) {
  if (reason === 'dislike') return pick(r, ['Yeah... no.', 'I don\'t think so.', 'Not a chance.']);
  if (reason === 'stranger') return v.warm ? pick(r, ["Ha, maybe once we know each other a bit better!", "You're sweet, but I barely know you."]) : pick(r, ['I don\'t even know you.', 'Uh, no thanks.']);
  if (reason === 'tired') return 'I am wiped out today. Another time?';
  return busyUntil ? `I'm swamped right now. Maybe after ${busyUntil}?` : "I'm busy right now, sorry.";
}

export function insultReaction(r: RNG, v: Voice) {
  if (v.confident && v.blunt) return pick(r, ['Excuse me? Get lost before I say something worse.', 'Wow. Classy. Go bother someone else.']);
  if (v.shy) return pick(r, ['...Why would you say that?', "I— okay. That's really hurtful."]);
  if (v.warm) return pick(r, ["That's uncalled for. I hope your day gets better.", "Wow. Okay. I'll pretend I didn't hear that."]);
  return pick(r, ['Rude.', 'What is your problem?', 'Charming. Really.']);
}

export function flirtReaction(r: RNG, v: Voice, success: boolean, taken: boolean) {
  if (taken) return pick(r, ["Ha, I'm flattered — but I'm seeing someone.", 'Sorry, I\'m taken.']);
  if (success) return v.shy ? pick(r, ['Oh! I... wow. *blushes* Thank you.', 'You think so? That\'s... really nice.']) : pick(r, ["Smooth. I like that.", 'Well aren\'t you charming.', 'Keep talking like that and I might say yes to coffee.']);
  return pick(r, ['Uh... let\'s keep it friendly.', 'Okay, that was a bit much.', 'Nice try.']);
}

export function giftReaction(r: RNG, v: Voice, item: string, love: boolean) {
  if (love) return pick(r, [`For me? A ${item}! You shouldn't have!`, `Oh, I love ${item}s! Thank you!`]);
  return pick(r, [`A ${item}? Thanks, that's thoughtful.`, `Oh — thank you. That's kind.`]);
}

export function goodbye(r: RNG, v: Voice, stage: string) {
  if (stage === 'Rival' || stage === 'Dislikes you') return pick(r, ['Bye.', 'Finally.', 'Whatever.']);
  if (v.chatty) return pick(r, ['See you around! Don\'t be a stranger!', 'Bye! This was nice!', 'Catch you later!']);
  if (v.shy) return pick(r, ['Okay... bye.', 'See you.', 'Bye!']);
  if (v.formal) return pick(r, ['Take care.', 'Have a good day.', 'Goodbye.']);
  return pick(r, ['See ya.', 'Later!', 'Take it easy.']);
}

export function annoyedRepeat(r: RNG, patient: boolean) {
  return patient ? pick(r, ['We were just talking a minute ago!', 'Back so soon?']) : pick(r, ["Again? I'm kind of busy.", 'You really like talking, huh.']);
}
