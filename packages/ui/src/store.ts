// Holds the user's data in memory and keeps it in step with wherever it is
// saved. The desktop app saves to a file, the phone app to the browser, and
// later both will sync. Each of those is a Backend.

import { parseAppData, stampFrom, stringifyAppData } from '@star/core';
import type { AppData, Stamp } from '@star/core';
import { emptyData } from '@star/core';

export interface Backend {
  /** The saved text, or '' when nothing has been saved yet. */
  load(): Promise<string>;
  save(text: string): Promise<void>;
  /** Calls back when the data was changed somewhere else (another window). */
  onExternalChange(callback: () => void): void;
}

export type Change = (data: AppData, at: Stamp) => AppData;

export class Store {
  data: AppData = emptyData();
  private listeners = new Set<() => void>();
  private text = '';
  private readonly backend: Backend;

  constructor(backend: Backend) {
    this.backend = backend;
  }

  async init(): Promise<void> {
    await this.reload();
    this.backend.onExternalChange(() => void this.reload());
  }

  /** Reads the saved data again. Tells listeners only if it really changed. */
  async reload(): Promise<void> {
    const text = await this.backend.load();
    if (text === this.text) return;
    this.text = text;
    this.data = parseAppData(text);
    this.notify();
  }

  /**
   * Makes one change and saves it. Reads the latest saved data first, so a
   * change made in another window a moment ago is not lost.
   */
  async apply(change: Change): Promise<void> {
    await this.reload();
    const next = change(this.data, stampFrom(new Date()));
    if (next === this.data) return;
    this.data = next;
    this.text = stringifyAppData(next);
    this.notify();
    await this.backend.save(this.text);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
