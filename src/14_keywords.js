/* ============================================================
   JIZURA-motionGraphic — keywords: independent keyword motion layer
   Phase 2: title + phrases scattered over the bg, beat-quantized,
   independent from the lyric motion. Uses J.mainDraw for animation.
   ============================================================ */
(() => {
'use strict';

/* default project settings (merged in 08_planner) */
J.defaultKeywords = () => ({
  enabled: false,
  title: '',
  titleMode: 'random',          // 'random' | 'fixed'
  titleX: 0.5, titleY: 0.18,    // fixed-mode position (0-1)
  phrases: [],
  fg: '#FFFFFF',                // keyword color
  accent: '#FFD400',            // title / emphasis color
  density: 0.5,                 // 0..1
});

/* ---------- planner: generate keyword events ---------- */
J.planKeywords = (plan, project) => {
  const kw = Object.assign(J.defaultKeywords(), project.keywords || {});
  plan.keywords = kw;
  plan.kwEvents = [];
  if (!kw.enabled) return plan;
  const phrases = (kw.phrases || []).map(s => String(s).trim()).filter(Boolean);
  const title = String(kw.title || '').trim();
  if (!phrases.length && !title) return plan;

  const dur = plan.duration || 60;
  const beats = (plan.beats || []).slice().sort((a, b) => a - b);
  const seed = (plan.seed || 0) ^ 0x9e37;
  let hs = seed | 0;
  const rnd = () => { hs = Math.imul(hs ^ (hs >>> 16), 2246822507); hs = Math.imul(hs ^ (hs >>> 13), 3266489909); hs ^= hs >>> 16; return (hs >>> 0) / 4294967296; };
  const pick = arr => arr[Math.floor(rnd() * arr.length) % arr.length];

  // quantize time to the next beat (or leave as-is if no beats)
  const quant = t => {
    if (!beats.length) return t;
    for (const b of beats) if (b >= t - 0.05) return b;
    return t;
  };

  // pick animation parts (simple, readable ones)
  const enters = ['blur', 'fadeStagger', 'riseMask', 'slideL', 'slideR', 'zoom', 'type', 'wipe'];
  const holds = ['still', 'pulse', 'float', 'heartbeat'];
  const exits = ['blur', 'fade', 'slideOutL', 'slideOutR', 'zoomFar', 'shrink'];
  const okEnter = enters.filter(k => J.ENTER[k]);
  const okHold = holds.filter(k => J.HOLD[k]);
  const okExit = exits.filter(k => J.EXIT[k]);

  const events = [];
  const density = kw.density ?? 0.5;
  // average gap between keyword appearances: 5s (sparse) .. 1.2s (dense)
  const gap = 5 - density * 3.8;

  // build the pool: phrases + title (title weighted higher)
  const pool = phrases.map(p => ({ text: p, isTitle: false, w: 1 }));
  if (title) {
    if (kw.titleMode === 'fixed') {
      // fixed title: recurring appearances at the fixed position
      const tGap = Math.max(6, 14 - density * 8);
      for (let t = 2; t < dur - 3; t += tGap * (0.85 + rnd() * 0.3)) {
        events.push(mkEvent(title, quant(t), true, kw.titleX, kw.titleY));
      }
    } else {
      pool.push({ text: title, isTitle: true, w: 2.5 });
    }
  }

  if (pool.length) {
    const totalW = pool.reduce((s, p) => s + p.w, 0);
    for (let t = 1 + rnd() * 2; t < dur - 2; t += gap * (0.7 + rnd() * 0.6)) {
      // weighted pick
      let r = rnd() * totalW, chosen = pool[0];
      for (const p of pool) { r -= p.w; if (r <= 0) { chosen = p; break; } }
      // random position (avoid extreme edges, avoid center-top where title may be)
      const x = 0.12 + rnd() * 0.76;
      const y = 0.15 + rnd() * 0.7;
      events.push(mkEvent(chosen.text, quant(t), chosen.isTitle, x, y));
    }
  }

  function mkEvent(text, start, isTitle, x, y) {
    const d = isTitle ? 2.6 + rnd() * 1.2 : 1.8 + rnd() * 1.4;
    return {
      text, start, dur: Math.min(d, dur - start),
      x, y, isTitle,
      size: isTitle ? 0.075 + rnd() * 0.02 : 0.045 + rnd() * 0.025,  // fraction of min(W,H)
      enter: pick(okEnter.length ? okEnter : ['blur']),
      hold: pick(okHold.length ? okHold : ['still']),
      exit: pick(okExit.length ? okExit : ['blur']),
      seed: (rnd() * 1e9) | 0,
      color: isTitle ? kw.accent : kw.fg,
    };
  }

  // sort by start time
  events.sort((a, b) => a.start - b.start);
  plan.kwEvents = events;
  return plan;
};

/* ---------- renderer: draw active keyword events ---------- */
J.drawKeywords = (ctx, plan, t, W, H, sc) => {
  const events = plan.kwEvents;
  if (!events || !events.length) return;
  const kw = plan.keywords || {};
  const minWH = Math.min(W, H);
  for (const ev of events) {
    if (t < ev.start || t > ev.start + ev.dur) continue;
    const lt = t - ev.start;
    // pseudo-cut for J.mainDraw
    const cut = {
      seed: ev.seed, dur: ev.dur,
      inDur: Math.min(0.45, ev.dur * 0.3),
      outDur: Math.min(0.4, ev.dur * 0.25),
      enter: ev.enter, hold: ev.hold, exit: ev.exit,
      stagger: 0,
    };
    const env = {
      ctx, W, H, sc, plan, cut,
      t, lt, ltb: lt,
      pass: 'main', step: 0, scale: 1, allowFilter: true,
      st: plan.style, fx: plan.fx, fps: plan.fps,
    };
    // minimal item
    const it = {
      text: ev.text,
      x: ev.x * W, y: ev.y * H,
      size: ev.size * minWH,
      color: ev.color,
      font: 'gothic_bold',
      mi: 0,
      // subtle shadow for readability over bg image
      shadow: { color: 'rgba(0,0,0,0.55)', blur: 8, dx: 0, dy: 2 },
    };
    try { J.mainDraw(env, it); } catch (e) { /* skip broken event */ }
  }
};

})();
