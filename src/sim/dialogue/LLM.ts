// Optional LLM dialogue provider (OpenAI-compatible chat endpoint, e.g. a local
// Ollama / LM Studio server). Core gameplay never depends on it: every call has
// a procedural fallback and a short timeout.
import type { NPC } from '../npc/types';
import { personalitySummary, relStage } from '../npc/types';

export interface LLMConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
}

export interface LLMContext {
  npc: NPC;
  occupation: string;
  workplace: string | null;
  activity: string;
  place: string;
  memories: string[];
  news: string[];
  weather: string;
  time: string;
  playerName: string;
}

export function buildPrompt(ctx: LLMContext, playerLine: string, fallback: string) {
  const n = ctx.npc;
  const traits = personalitySummary(n.traits).join(', ') || 'balanced';
  const stage = relStage(n.relPlayer);
  const sys = [
    `You are ${n.first} ${n.last}, a ${n.age}-year-old resident of Echo City.`,
    `Occupation: ${ctx.occupation}${ctx.workplace ? ` at ${ctx.workplace}` : ''}. Right now you are ${ctx.activity} at ${ctx.place}.`,
    `Personality: ${traits}. Current mood: ${n.mood > 0.3 ? 'good' : n.mood < -0.3 ? 'bad' : 'okay'}.`,
    `Your relationship with ${ctx.playerName} (the person talking to you): ${stage}.`,
    ctx.memories.length ? `Things you remember: ${ctx.memories.join('; ')}.` : '',
    ctx.news.length ? `Recent city news: ${ctx.news.join('; ')}.` : '',
    `It is ${ctx.time}, the weather is ${ctx.weather}.`,
    'Reply in character with ONE or TWO short spoken sentences. No narration, no emojis, no quotes.',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: sys },
    { role: 'user', content: `${ctx.playerName} says: "${playerLine}". (A natural answer could be: "${fallback}")` },
  ];
}

export async function llmRespond(cfg: LLMConfig, ctx: LLMContext, playerLine: string, fallback: string): Promise<string | null> {
  if (!cfg.enabled || !cfg.endpoint) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, messages: buildPrompt(ctx, playerLine, fallback), max_tokens: 90, temperature: 0.85, stream: false }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text: string | undefined = j?.choices?.[0]?.message?.content ?? j?.message?.content;
    if (!text) return null;
    return text.replace(/^["']|["']$/g, '').trim().slice(0, 280);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
