// The test bench page: plays the part of the Rust side when the three pages
// run in an ordinary browser.

import type { BenchMessage } from './platform.ts';

const channel = new BroadcastChannel('star');
const send = (message: BenchMessage) => channel.postMessage(message);
const frame = (id: string) => document.getElementById(id) as HTMLIFrameElement;

function show(id: 'panel' | 'quickadd', open: boolean) {
  frame(id).classList.toggle('open', open);
  if (open) {
    frame(id).contentWindow?.focus();
    send({ type: 'shown', window: id });
  }
}

channel.onmessage = (event: MessageEvent<BenchMessage>) => {
  const m = event.data;
  if (m.type !== 'ui') return;
  if (m.action === 'toggle-panel') show('panel', !frame('panel').classList.contains('open'));
  if (m.action === 'quick-add') show('quickadd', true);
  if (m.action === 'hide' && (m.from === 'panel' || m.from === 'quickadd')) show(m.from, false);
};

// The eyes follow the mouse, as the real app's watcher makes them.
let eyes = '0,0';
document.addEventListener('mousemove', (event) => {
  const box = frame('star').getBoundingClientRect();
  const dx = event.clientX - (box.left + box.width / 2);
  const dy = event.clientY - (box.top + box.height / 2);
  const dist = Math.hypot(dx, dy);
  const part = (v: number) => (dist < 86 || Math.abs(v) / dist < 0.38 ? 0 : Math.sign(v));
  const next = `${part(dx)},${part(dy)}`;
  if (next === eyes) return;
  eyes = next;
  send({ type: 'eyes', dx: part(dx), dy: part(dy) });
});

document.querySelectorAll<HTMLButtonElement>('button[data-menu]').forEach((button) => {
  button.addEventListener('click', () => {
    const id = button.dataset.menu!;
    if (id === 'quick_add') show('quickadd', true);
    else if (id === 'reset') {
      localStorage.clear();
      location.reload();
    } else if (id === 'size') {
      const prefs = JSON.parse(localStorage.getItem('star.prefs') ?? '{}') as { size?: string };
      localStorage.setItem('star.prefs', JSON.stringify({ ...prefs, size: prefs.size === 'small' ? 'normal' : 'small' }));
      send({ type: 'prefs' });
    } else send({ type: 'menu', id });
  });
});
