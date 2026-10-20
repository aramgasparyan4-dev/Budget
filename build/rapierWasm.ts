// Vite build plugin: Rapier's "compat" package carries its WebAssembly as a 4 MB base64 string
// inside the JavaScript. Its loader also accepts a URL, so in production builds the string is
// swapped for the .wasm file itself: about 1.3 MB less to download, no base64 decoding, and the
// browser can compile it while it streams in (and starts fetching it as the page loads).
// If the package ever changes shape, the plugin warns and leaves the inlined copy alone.
import type { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const BASE64_INIT = /module_or_path:([A-Za-z_$][\w$]*)\.toByteArray\("[A-Za-z0-9+/=]{100000,}"\)\.buffer/;

export function rapierWasmFile(): Plugin {
  let ref = '';
  let base = '/';
  return {
    name: 'rapier-wasm-file',
    apply: 'build',
    configResolved(c) {
      base = c.base;
    },
    buildStart() {
      // the package only exports its entry, so find the file next to it
      const dist = dirname(createRequire(import.meta.url).resolve('@dimforge/rapier3d-compat'));
      const wasm = readFileSync(join(dist, 'rapier_wasm3d_bg.wasm'));
      ref = this.emitFile({ type: 'asset', name: 'rapier.wasm', source: wasm });
    },
    transform(code, id) {
      if (!/rapier3d-compat[\\/]dist[\\/]rapier\.mjs/.test(id)) return null;
      if (!BASE64_INIT.test(code)) {
        this.warn('rapier-wasm-file: inlined WebAssembly not found, keeping it inlined');
        return null;
      }
      // a URL string: the loader fetches it and compiles while it streams
      return { code: code.replace(BASE64_INIT, `module_or_path:import.meta.ROLLUP_FILE_URL_${ref}`), map: null };
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const file = ctx.bundle && Object.values(ctx.bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.wasm'));
        if (!file) return [];
        return [{ tag: 'link', attrs: { rel: 'preload', href: base + file.fileName, as: 'fetch', type: 'application/wasm', crossorigin: '' }, injectTo: 'head' }];
      },
    },
  };
}
