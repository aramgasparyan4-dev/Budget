/* Neural Kick — skins. Each one is a hand-drawn, simplified take on an AI
   product's logo, painted on an app-icon badge inside a unit box (-0.5..0.5). */
(function (g) {
  'use strict';
  const NK = (g.NK = g.NK || {});
  const TAU = Math.PI * 2;

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  NK.roundRect = rr;

  const SKINS = [
    {
      id: 'claude', name: 'Claude', by: 'Anthropic', bg: '#F3EDE2', accent: '#D97757',
      draw(c) {
        c.strokeStyle = '#D97757'; c.lineCap = 'round';
        const len = [0.36, 0.3, 0.37, 0.31, 0.35, 0.29, 0.37, 0.3, 0.36, 0.31, 0.34, 0.3];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + (i % 3) * 0.07 - 0.2;
          c.lineWidth = i % 2 ? 0.062 : 0.078;
          c.beginPath(); c.moveTo(Math.cos(a) * 0.05, Math.sin(a) * 0.05);
          c.lineTo(Math.cos(a) * len[i], Math.sin(a) * len[i]); c.stroke();
        }
      },
    },
    {
      id: 'chatgpt', name: 'ChatGPT', by: 'OpenAI', bg: '#10A37F', accent: '#10A37F',
      draw(c) {
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 0.05; c.lineJoin = 'round';
        for (let i = 0; i < 6; i++) {
          c.save(); c.rotate((i / 6) * TAU); c.translate(0.035, -0.165);
          rr(c, -0.2, -0.105, 0.4, 0.21, 0.105); c.stroke(); c.restore();
        }
      },
    },
    {
      id: 'gemini', name: 'Gemini', by: 'Google', bg: '#F6F8FF', accent: '#6C8DF5',
      draw(c) {
        const gr = c.createLinearGradient(-0.35, 0.3, 0.35, -0.3);
        gr.addColorStop(0, '#4285F4'); gr.addColorStop(0.55, '#9B72CB'); gr.addColorStop(1, '#D96570');
        c.fillStyle = gr;
        const r = 0.4, k = 0.06;
        c.beginPath(); c.moveTo(0, -r);
        c.quadraticCurveTo(k, -k, r, 0); c.quadraticCurveTo(k, k, 0, r);
        c.quadraticCurveTo(-k, k, -r, 0); c.quadraticCurveTo(-k, -k, 0, -r);
        c.fill();
      },
    },
    {
      id: 'grok', name: 'Grok', by: 'xAI', bg: '#0B0B0C', accent: '#E8E8E8',
      draw(c) {
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 0.075; c.lineCap = 'butt';
        const a = -Math.PI / 4;
        c.beginPath(); c.arc(0, 0, 0.25, a + 0.55, a + TAU - 0.55); c.stroke();
        c.beginPath(); c.moveTo(-0.13, 0.13); c.lineTo(0.35, -0.35); c.stroke();
      },
    },
    {
      id: 'meta', name: 'Meta AI', by: 'Meta', bg: '#FFFFFF', accent: '#0A7CFF',
      draw(c) {
        const gr = c.createLinearGradient(-0.4, 0, 0.4, 0);
        gr.addColorStop(0, '#0064E0'); gr.addColorStop(0.5, '#0A7CFF'); gr.addColorStop(1, '#00B2FF');
        c.strokeStyle = gr; c.lineWidth = 0.095; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath();
        for (let i = 0; i <= 60; i++) {
          const t = (i / 60) * TAU, d = 1 + Math.sin(t) * Math.sin(t);
          const x = (0.4 * Math.cos(t)) / d, y = (0.62 * Math.sin(t) * Math.cos(t)) / d;
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.stroke();
      },
    },
    {
      id: 'mistral', name: 'Mistral', by: 'Mistral AI', bg: '#FFF8E8', accent: '#FA500F',
      draw(c) {
        const cols = ['#FFD800', '#FFAF00', '#FF8205', '#FA500F', '#E10500'];
        const m = ['10001', '11011', '11111', '10101', '10001'], s = 0.14, o = -0.35;
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
          if (m[y][x] === '1') { c.fillStyle = cols[y]; c.fillRect(o + x * s, o + y * s, s + 0.004, s + 0.004); }
        }
      },
    },
    {
      id: 'deepseek', name: 'DeepSeek', by: 'DeepSeek', bg: '#FFFFFF', accent: '#4D6BFE',
      draw(c) {
        c.fillStyle = '#4D6BFE';
        c.beginPath(); c.ellipse(0.05, 0.06, 0.29, 0.2, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(-0.18, 0.02);
        c.quadraticCurveTo(-0.3, -0.06, -0.4, -0.3); c.quadraticCurveTo(-0.27, -0.25, -0.22, -0.16);
        c.quadraticCurveTo(-0.2, -0.3, -0.08, -0.34); c.quadraticCurveTo(-0.1, -0.14, 0.0, -0.1);
        c.closePath(); c.fill();
        c.fillStyle = '#FFFFFF';
        c.beginPath(); c.arc(0.19, 0.0, 0.035, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(0.36, 0.08); c.lineTo(0.2, 0.12); c.lineTo(0.33, 0.17); c.closePath(); c.fill();
      },
    },
    {
      id: 'perplexity', name: 'Perplexity', by: 'Perplexity', bg: '#12343B', accent: '#22B8CD',
      draw(c) {
        c.strokeStyle = '#22B8CD'; c.lineWidth = 0.05; c.lineJoin = 'miter'; c.lineCap = 'butt';
        c.beginPath(); c.moveTo(0, -0.38); c.lineTo(0, 0.38); c.stroke();
        c.beginPath(); c.moveTo(-0.26, -0.33); c.lineTo(0, -0.09); c.lineTo(0.26, -0.33); c.stroke();
        c.beginPath(); c.moveTo(-0.26, -0.33); c.lineTo(-0.26, -0.09); c.moveTo(0.26, -0.33); c.lineTo(0.26, -0.09); c.stroke();
        c.strokeRect(-0.3, -0.09, 0.6, 0.27);
        c.beginPath(); c.moveTo(-0.24, 0.18); c.lineTo(-0.24, 0.34); c.lineTo(0, 0.12); c.lineTo(0.24, 0.34); c.lineTo(0.24, 0.18); c.stroke();
      },
    },
    {
      id: 'huggingface', name: 'Hugging Face', by: 'Hugging Face', bg: '#2A2218', accent: '#FFD21E',
      draw(c) {
        c.fillStyle = '#FFD21E'; c.beginPath(); c.arc(0, -0.03, 0.33, 0, TAU); c.fill();
        c.fillStyle = '#3A3B45';
        c.beginPath(); c.arc(-0.12, -0.1, 0.045, 0, TAU); c.arc(0.12, -0.1, 0.045, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(-0.14, 0.03); c.quadraticCurveTo(0, 0.24, 0.14, 0.03); c.quadraticCurveTo(0, 0.08, -0.14, 0.03); c.fill();
        c.fillStyle = '#FF9D0B';
        c.beginPath(); c.ellipse(-0.25, 0.26, 0.12, 0.085, -0.5, 0, TAU); c.ellipse(0.25, 0.26, 0.12, 0.085, 0.5, 0, TAU); c.fill();
      },
    },
  ];
  NK.SKINS = SKINS;

  /* Paint a skin badge at any size onto a context (used for menu previews). */
  NK.paintSkin = function (c, skin, size) {
    c.save();
    c.scale(size, size);
    rr(c, -0.5, -0.5, 1, 1, 0.24);
    c.fillStyle = skin.bg; c.fill();
    c.save(); c.clip(); skin.draw(c); c.restore();
    rr(c, -0.5, -0.5, 1, 1, 0.24);
    c.lineWidth = 0.035; c.strokeStyle = 'rgba(10,12,30,0.55)'; c.stroke();
    c.restore();
  };

  /* Cached sprite for in-game drawing. */
  const cache = {};
  NK.skinSprite = function (skin) {
    if (cache[skin.id]) return cache[skin.id];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.translate(64, 64);
    NK.paintSkin(c, skin, 120);
    return (cache[skin.id] = cv);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
