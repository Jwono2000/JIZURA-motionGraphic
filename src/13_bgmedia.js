/* ============================================================
   JIZURA-motionGraphic — bg media: user images / videos as background
   Phase 1: background image/video input + bgMedia background part
   ============================================================ */
(() => {
'use strict';

/* runtime media list: [{kind:'image'|'video', name, el, url, w, h, duration}] */
J.bgMediaList = [];
/* runtime config (mirrored to S.project.bgMedia for save/load) */
J.bgMediaCfg = { mode: 'off', sw: 'part', fit: 'cover', dim: 0.25 };

/* ---------- IndexedDB persistence (own db, like songs) ---------- */
const IDB2 = { db: null };
IDB2.open = () => IDB2.db || (IDB2.db = new Promise((res, rej) => {
  if (typeof indexedDB === 'undefined') return rej(new Error('no IndexedDB'));
  const r = indexedDB.open('jizura-bgmedia', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('media'); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const idbTx = (mode, fn) => IDB2.open().then(db => new Promise((res, rej) => {
  const tx = db.transaction('media', mode), st = tx.objectStore('media');
  const rq = fn(st);
  rq.onsuccess = () => res(rq.result);
  rq.onerror = () => rej(rq.error);
}));
J.saveBgMedia = (file) => idbTx('readwrite', st => st.put(file, 'm' + J.bgMediaList.length + '_' + file.name)).catch(() => {});
J.loadBgMediaAll = async () => {
  const files = await idbTx('readonly', st => st.getAll()).catch(() => []) || [];
  for (const f of files) { try { await J.addBgMedia(f, true); } catch (e) {} }
};
J.clearBgMediaStore = () => idbTx('readwrite', st => st.clear()).catch(() => {});

/* ---------- load / remove ---------- */
J.addBgMedia = (file, restored) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const kind = /^video\//.test(file.type) ? 'video' : 'image';
  const done = (el, w, h, duration) => {
    const e = { kind, name: file.name, el, url, w, h, duration: duration || 0 };
    J.bgMediaList.push(e);
    if (!restored) J.saveBgMedia(file);
    resolve(e);
  };
  if (kind === 'video') {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.onloadedmetadata = () => done(v, v.videoWidth, v.videoHeight, v.duration || 0);
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('video load failed')); };
    v.src = url;
    setTimeout(() => { if (!v.videoWidth) { URL.revokeObjectURL(url); reject(new Error('video timeout')); } }, 20000);
  } else {
    const img = new Image();
    img.onload = () => done(img, img.naturalWidth, img.naturalHeight, 0);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
    img.src = url;
  }
});

J.removeBgMedia = (i) => {
  const e = J.bgMediaList[i];
  if (!e) return;
  if (e.kind === 'video') { try { e.el.pause(); } catch (err) {} }
  URL.revokeObjectURL(e.url);
  J.bgMediaList.splice(i, 1);
  // rebuild store
  J.clearBgMediaStore();
  // re-save remaining (we don't keep the File objects; skip re-save — list rebuild on next add)
};

J.bgMediaClear = () => {
  for (let i = J.bgMediaList.length - 1; i >= 0; i--) J.removeBgMedia(i);
};

/* ---------- which media index to show ---------- */
J.bgMediaIndex = (env) => {
  const n = J.bgMediaList.length;
  if (n <= 1) return 0;
  const sw = (env.plan && env.plan.bgMedia && env.plan.bgMedia.sw) || J.bgMediaCfg.sw || 'part';
  if (sw === 'random') {
    const seg = Math.floor(env.t / 8);
    const seed = (env.plan && env.plan.seed) || 0;
    let h = (seed ^ Math.imul(seg + 1, 2654435761)) | 0;
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    return ((h >>> 0) % n + n) % n;
  }
  // 'part': section index (blocks between blank lines -> plan.lines[].sec)
  let sec = 0;
  const plan = env.plan;
  if (plan && plan.lines && env.cut) {
    const li = env.cut.line;
    for (const L of plan.lines) {
      if (L.index === li && L.sec != null) { sec = L.sec; break; }
    }
  }
  return ((sec % n) + n) % n;
};

/* keep video playing / seek to timeline (preview realtime, export seek) */
J.bgMediaSync = (env) => {
  const list = J.bgMediaList;
  if (!list.length) return;
  const m = list[J.bgMediaIndex(env) % list.length];
  if (!m || m.kind !== 'video') return;
  const v = m.el;
  if (v.readyState < 2 || !v.duration) return;
  const target = ((env.t % v.duration) + v.duration) % v.duration;
  if (Math.abs(v.currentTime - target) > 0.15) {
    try { v.currentTime = target; } catch (e) {}
  }
  if (v.paused) { v.play().catch(() => {}); }
};

/* per-frame hook for export (seek video before capture) */
J.bgMediaSyncFrame = async (t) => {
  const list = J.bgMediaList;
  if (!list.length) return;
  // find index the same way draw() would (no env here; replicate 'part' via time is hard —
  // export renders sequentially so we sync every video to t)
  for (const m of list) {
    if (m.kind !== 'video' || !m.duration) continue;
    const v = m.el;
    if (v.readyState < 2) continue;
    const target = ((t % v.duration) + v.duration) % v.duration;
    if (Math.abs(v.currentTime - target) > 1 / 30) {
      try {
        v.currentTime = target;
        await new Promise((res) => {
          const to = setTimeout(res, 120);
          v.onseeked = () => { clearTimeout(to); res(); };
        });
      } catch (e) {}
    }
  }
};

/* ---------- draw helpers ---------- */
function drawFit(ctx, el, vw, vh, W, H, fit) {
  if (!vw || !vh) return;
  const s = fit === 'contain' ? Math.min(W / vw, H / vh) : Math.max(W / vw, H / vh);
  const dw = vw * s, dh = vh * s;
  ctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

/* ---------- register as a real background part ---------- */
const reg = (k, d) => J.register('bg', k, d, 'bgmedia');
reg('bgMedia', {
  name: '미디어 배경',
  tags: ['pop', 'graphic', 'emotional', 'calm', 'editorial'],
  w: 1,
  plan: rng => ({ seed: (rng.int(1e9) >>> 0) }),
  draw(env, P) {
    const ctx = env.ctx;
    const list = J.bgMediaList;
    if (!list.length) return;
    const m = list[J.bgMediaIndex(env) % list.length];
    if (!m) return;
    const { W, H } = env;
    const cfg = (env.plan && env.plan.bgMedia) || J.bgMediaCfg;
    const fit = cfg.fit || 'cover';
    J.bgMediaSync(env);
    if (m.kind === 'video') {
      const v = m.el;
      if (v.readyState < 2 || !v.videoWidth) return;
      drawFit(ctx, v, v.videoWidth, v.videoHeight, W, H, fit);
    } else {
      if (!m.el.complete || !m.w) return;
      drawFit(ctx, m.el, m.w, m.h, W, H, fit);
    }
    const dim = cfg.dim || 0;
    if (dim > 0.01) {
      ctx.fillStyle = `rgba(0,0,0,${dim.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
});

})();
