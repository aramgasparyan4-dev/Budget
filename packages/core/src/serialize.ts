// Turning AppData into text for a file or a database, and back.
// Reading is forgiving: anything missing gets its default, so a file written
// by an older version of the app still loads.

import { DEFAULT_SETTINGS, emptyData } from './types.ts';
import type { AppData, Session, Settings, Task } from './types.ts';

export const DATA_VERSION = 1;

export function stringifyAppData(data: AppData): string {
  return JSON.stringify({ version: DATA_VERSION, ...data }, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTask(value: unknown): value is Task {
  return isRecord(value) && typeof value.id === 'string' && typeof value.kind === 'string' && typeof value.title === 'string';
}

function isSession(value: unknown): value is Session {
  return isRecord(value) && typeof value.id === 'string' && typeof value.startedAt === 'string';
}

/** Reads saved text. Empty or unreadable text gives fresh, empty data. */
export function parseAppData(text: string): AppData {
  const fresh = emptyData();
  if (text.trim().length === 0) return fresh;

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fresh;
  }
  if (!isRecord(raw)) return fresh;

  const settings: Settings = { ...fresh.settings, ...(isRecord(raw.settings) ? (raw.settings as Partial<Settings>) : {}) };
  if (!Array.isArray(settings.quietHours)) settings.quietHours = DEFAULT_SETTINGS.quietHours;
  if (!Array.isArray(settings.daysOff)) settings.daysOff = [];
  if (!Array.isArray(settings.revisionOffsets)) settings.revisionOffsets = DEFAULT_SETTINGS.revisionOffsets;

  return {
    tasks: Array.isArray(raw.tasks) ? raw.tasks.filter(isTask) : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions.filter(isSession) : [],
    settings,
  };
}
